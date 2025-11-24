import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size: number };
      parts?: any[];
    }>;
  };
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  } catch {
    return '';
  }
}

function extractEmailBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }

    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
      }
    }

    for (const part of payload.parts) {
      if (part.parts) {
        const nestedBody = extractEmailBody(part);
        if (nestedBody) return nestedBody;
      }
    }
  }

  return '';
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: connection, error: connError } = await supabase
      .from('gmail_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_connected', true)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Gmail not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(connection.access_token_expires_at);
    let accessToken = connection.access_token;

    if (now >= expiresAt) {
      const clientId = Deno.env.get('VITE_GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('VITE_GOOGLE_CLIENT_SECRET');

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh access token');
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

      await supabase
        .from('gmail_connections')
        .update({
          access_token: accessToken,
          access_token_expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', connection.id);
    }

    const query = 'label:inbox is:unread';
    const gmailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!gmailResponse.ok) {
      throw new Error('Failed to fetch Gmail messages');
    }

    const gmailData = await gmailResponse.json();
    const messages = gmailData.messages || [];

    let processedCount = 0;
    let newInquiriesCount = 0;

    // Process emails in parallel batches of 5 for speed
    const batchSize = 5;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const batchPromises = batch.map(async (message) => {
        try {
          const messageResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );

          if (!messageResponse.ok) return null;

          const messageData: GmailMessage = await messageResponse.json();
          const headers = messageData.payload.headers;

          const subject = getHeader(headers, 'subject');
          const from = getHeader(headers, 'from');
          const fromEmail = from.match(/<(.+?)>/)?.[1] || from;
          const fromName = from.replace(/<.+?>/, '').trim();
          const body = extractEmailBody(messageData.payload);
          const receivedDate = new Date(parseInt(messageData.internalDate));

          const { data: existing } = await supabase
            .from('crm_email_inbox')
            .select('id')
            .eq('message_id', messageData.id)
            .maybeSingle();

          if (existing) return null;

          // Call AI parser to analyze email
          let isInquiry = false;
          let parsedData = null;

          try {
            const parseResponse = await fetch(`${supabaseUrl}/functions/v1/parse-pharma-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                emailSubject: subject,
                emailBody: body,
                fromEmail: fromEmail,
                fromName: fromName,
              }),
            });

            if (parseResponse.ok) {
              const parseResult = await parseResponse.json();
              if (parseResult.success && parseResult.data) {
                parsedData = parseResult.data;
                isInquiry = (
                  (parsedData.productName && parsedData.productName.length > 2) &&
                  parsedData.confidenceScore >= 0.5
                );
              }
            }
          } catch (parseError) {
            console.error('Failed to parse email:', parseError);
          }

          // Insert email into inbox
          // Note: is_processed is set to false for inquiries so they appear in Command Center and CRM Email Inbox
          const { data: insertedEmail, error: insertError } = await supabase
            .from('crm_email_inbox')
            .insert({
              gmail_connection_id: connection.id,
              message_id: messageData.id,
              thread_id: messageData.threadId,
              subject,
              from_email: fromEmail,
              from_name: fromName,
              body: body,
              received_date: receivedDate.toISOString(),
              is_processed: false,
              is_inquiry: isInquiry,
            })
            .select()
            .single();

          if (insertError || !insertedEmail) return null;

          // If it's an inquiry, create inquiry record
          if (isInquiry && parsedData) {
            const { data: inquiryData, error: inquiryError } = await supabase
              .from('crm_inquiries')
              .insert({
                inquiry_date: receivedDate.toISOString(),
                product_name: parsedData.productName || 'Unknown Product',
                quantity: parsedData.quantity || '',
                supplier_name: parsedData.supplierName,
                supplier_country: parsedData.supplierCountry,
                company_name: parsedData.companyName,
                contact_person: parsedData.contactPerson,
                contact_email: fromEmail,
                contact_phone: parsedData.contactPhone,
                coa_sent: parsedData.coaRequested || false,
                msds_sent: parsedData.msdsRequested || false,
                sample_sent: parsedData.sampleRequested || false,
                price_quoted: parsedData.priceRequested || false,
                purpose_icons: parsedData.purposeIcons,
                delivery_date_expected: parsedData.deliveryDateExpected,
                priority: parsedData.urgency || 'medium',
                status: 'new',
                source: 'email',
                remarks: parsedData.remarks,
                source_email_id: insertedEmail.id,
                ai_confidence_score: parsedData.confidenceScore,
              })
              .select()
              .single();

            if (inquiryError) {
              console.error('Error creating inquiry for email:', insertedEmail.id, inquiryError);
              // Continue processing even if inquiry creation fails
            } else {
              console.log('Successfully created inquiry:', inquiryData?.inquiry_number);
            }

            return { processed: true, inquiry: !inquiryError };
          }

          return { processed: true, inquiry: false };
        } catch (error) {
          console.error('Error processing message:', error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result?.processed) {
          processedCount++;
          if (result.inquiry) newInquiriesCount++;
        }
      }
    }

    await supabase
      .from('gmail_connections')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        processedCount,
        newInquiriesCount,
        totalMessages: messages.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error syncing emails:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to sync emails'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
