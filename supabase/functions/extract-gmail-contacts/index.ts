import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const INTERNAL_DOMAINS = ['anzen.co.in', 'shubham.co.in', 'shubham.com'];
const INTERNAL_EMAILS = ['lunkad.v@gmail.com', 'sumathi.lunkad@gmail.com'];

interface ExtractedContact {
  companyName: string;
  customerName: string;
  emailIds: string[];
  phone: string;
  mobile: string;
  website: string;
  address: string;
  source: string;
  confidence: number;
}

function isInternalEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase();
  if (INTERNAL_EMAILS.some(internal => lowerEmail === internal.toLowerCase())) {
    return true;
  }
  const domain = email.split('@')[1]?.toLowerCase();
  return INTERNAL_DOMAINS.some(internalDomain => domain === internalDomain);
}

async function enrichCompanyData(email: string, domain: string): Promise<{ companyName: string; website: string; confidence: number }> {
  try {
    if (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook')) {
      return { companyName: '', website: '', confidence: 0.3 };
    }

    const baseDomain = domain.split('.').slice(0, -1).join('.');
    let companyName = baseDomain
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    if (domain.endsWith('.co.id') && !companyName.toLowerCase().startsWith('pt')) {
      companyName = 'PT ' + companyName;
    } else if (domain.endsWith('.co.in')) {
      companyName = companyName + ' Pvt Ltd';
    }

    const website = `https://www.${domain}`;

    try {
      const response = await fetch(website, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        return { companyName, website, confidence: 0.8 };
      }
    } catch {
      return { companyName, website: `www.${domain}`, confidence: 0.6 };
    }

    return { companyName, website: `www.${domain}`, confidence: 0.6 };
  } catch (error) {
    console.error('Error enriching company data:', error);
    return { companyName: '', website: '', confidence: 0.3 };
  }
}

async function extractContactWithAI(
  fromEmail: string,
  fromName: string | undefined,
  emailSubject: string,
  emailBody: string,
  openaiApiKey: string
): Promise<ExtractedContact | null> {
  try {
    const systemPrompt = `You are a contact information extraction specialist. Extract structured contact information from email data.

CRITICAL RULES:
1. IGNORE email body greetings like "Dear Sir", "Thank you", "Mohon maaf belum bisa Bu" - these are NOT company names
2. Extract REAL company names from signatures, NOT from email body text
3. For domain like "@genero.co.id", suggest full company name like "PT Genero Pharmaceuticals"
4. For domain like "@telkom.co.id", suggest "PT Telkom Indonesia"
5. Validate that company name is a REAL business entity, not email body text
6. Extract contact person name from signature, NOT greetings
7. Extract phone numbers in international format when possible
8. Find website URL or construct from email domain

Extract and return JSON:
{
  "companyName": "Full company name (NOT email body text)",
  "contactPerson": "Person name from signature",
  "phone": "Phone number",
  "mobile": "Mobile number",
  "website": "Company website URL",
  "address": "Full address if found",
  "confidence": 0.0-1.0 (0.0-0.4 = low, 0.5-0.7 = medium, 0.8-1.0 = high)
}

Set confidence LOW (< 0.4) if:
- Company name is email body greeting/text
- No clear business signature found
- Generic email domain (gmail, yahoo, etc.) with no company info`;

    const userPrompt = `Extract contact information from this email:

FROM: ${fromName || 'Unknown'} <${fromEmail}>
SUBJECT: ${emailSubject}

EMAIL BODY:
${emailBody.substring(0, 3000)}

Return ONLY valid JSON.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const aiResult = JSON.parse(data.choices[0].message.content);

    if (aiResult.confidence < 0.4) {
      return null;
    }

    const domain = fromEmail.split('@')[1];
    let enrichedData = { companyName: aiResult.companyName, website: aiResult.website, confidence: aiResult.confidence };

    if (!aiResult.companyName || aiResult.companyName.length < 3) {
      enrichedData = await enrichCompanyData(fromEmail, domain);
    }

    return {
      companyName: enrichedData.companyName || aiResult.companyName || '',
      customerName: aiResult.contactPerson || fromName || '',
      emailIds: [fromEmail],
      phone: aiResult.phone || '',
      mobile: aiResult.mobile || '',
      website: enrichedData.website || aiResult.website || '',
      address: aiResult.address || '',
      source: 'Gmail',
      confidence: Math.max(aiResult.confidence, enrichedData.confidence)
    };
  } catch (error) {
    console.error('AI extraction error:', error);
    return null;
  }
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    console.log('Refreshing access token...');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('Token refreshed successfully');
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

async function fetchGmailMessages(
  accessToken: string,
  maxResults: number,
  supabase: any,
  connectionId: string,
  userId: string
): Promise<any[]> {
  const messages: any[] = [];
  let pageToken = '';

  try {
    const { data: processedMessages } = await supabase
      .from('gmail_processed_messages')
      .select('gmail_message_id')
      .eq('connection_id', connectionId)
      .eq('user_id', userId);

    const processedIds = new Set((processedMessages || []).map((m: any) => m.gmail_message_id));
    console.log(`Already processed ${processedIds.size} messages, will skip these`);

    while (messages.length < maxResults) {
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`;

      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('Gmail API error:', listResponse.status, errorText);
        throw new Error(`Gmail API error: ${listResponse.status} - ${listResponse.statusText}`);
      }

      const listData = await listResponse.json();

      if (!listData.messages || listData.messages.length === 0) {
        break;
      }

      for (const message of listData.messages) {
        if (processedIds.has(message.id)) {
          console.log(`Skipping already processed message: ${message.id}`);
          continue;
        }

        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`;

        const detailResponse = await fetch(detailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          messages.push(detailData);
        }

        if (messages.length >= maxResults) {
          break;
        }
      }

      if (!listData.nextPageToken || messages.length >= maxResults) {
        break;
      }

      pageToken = listData.nextPageToken;
    }

    console.log(`Fetched ${messages.length} NEW unprocessed messages`);
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    throw error;
  }

  return messages;
}

function extractEmailAddresses(headers: any[]): { email: string; name?: string; field: string }[] {
  const addresses: { email: string; name?: string; field: string }[] = [];
  const fields = ['from', 'to', 'cc'];

  for (const field of fields) {
    const header = headers.find(h => h.name.toLowerCase() === field);
    if (header) {
      const emailRegex = /([^<\s]+@[^>\s]+)/g;
      const nameRegex = /([^<]+)<([^>]+)>/g;

      const emails = header.value.match(emailRegex) || [];
      const namesWithEmails = [...header.value.matchAll(nameRegex)];

      for (const email of emails) {
        const nameMatch = namesWithEmails.find(nm => nm[2] === email);
        addresses.push({
          email: email.trim(),
          name: nameMatch ? nameMatch[1].trim().replace(/"/g, '') : undefined,
          field: field,
        });
      }
    }
  }

  return addresses;
}

function getEmailBody(message: any): string {
  let body = '';

  if (message.payload.body && message.payload.body.data) {
    body = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  } else if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
  }

  return body;
}

async function extractContactsWithAI(
  messages: any[],
  openaiApiKey: string,
  supabase: any,
  connectionId: string,
  userId: string
): Promise<Map<string, ExtractedContact>> {
  const contactsMap = new Map<string, ExtractedContact>();
  const processedMessageIds: string[] = [];

  for (const message of messages) {
    try {
      const headers = message.payload.headers;
      const addresses = extractEmailAddresses(headers);
      const fromAddresses = addresses.filter(addr => addr.field === 'from');

      if (fromAddresses.length === 0) continue;

      const fromAddr = fromAddresses[0];

      if (isInternalEmail(fromAddr.email)) {
        processedMessageIds.push(message.id);
        continue;
      }

      if (fromAddr.email.includes('noreply') || fromAddr.email.includes('no-reply')) {
        processedMessageIds.push(message.id);
        continue;
      }

      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
      const subject = subjectHeader?.value || '';
      const body = getEmailBody(message);

      const extractedContact = await extractContactWithAI(
        fromAddr.email,
        fromAddr.name,
        subject,
        body,
        openaiApiKey
      );

      if (extractedContact && extractedContact.confidence >= 0.5) {
        const domain = fromAddr.email.split('@')[1];
        const isGenericEmail = domain && (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook'));
        const companyKey = isGenericEmail ? fromAddr.email : domain;

        const existing = contactsMap.get(companyKey);
        if (existing) {
          if (!existing.emailIds.includes(fromAddr.email)) {
            existing.emailIds.push(fromAddr.email);
          }
          existing.confidence = Math.max(existing.confidence, extractedContact.confidence);
        } else {
          contactsMap.set(companyKey, extractedContact);
        }

        await supabase
          .from('gmail_processed_messages')
          .insert({
            user_id: userId,
            connection_id: connectionId,
            gmail_message_id: message.id,
            contacts_extracted: 1,
            extraction_data: extractedContact
          });
      } else {
        processedMessageIds.push(message.id);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      processedMessageIds.push(message.id);
    }
  }

  if (processedMessageIds.length > 0) {
    await supabase
      .from('gmail_processed_messages')
      .insert(
        processedMessageIds.map(msgId => ({
          user_id: userId,
          connection_id: connectionId,
          gmail_message_id: msgId,
          contacts_extracted: 0,
          extraction_data: null
        }))
      );
  }

  return contactsMap;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Extract Gmail Contacts function called');

    const { access_token, max_emails = 100, user_id, connection_id } = await req.json();

    if (!access_token || !user_id || !connection_id) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'access_token, user_id, and connection_id are required', success: false }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', success: false }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let currentAccessToken = access_token;

    console.log(`Fetching up to ${max_emails} unprocessed emails...`);

    try {
      const messages = await fetchGmailMessages(
        currentAccessToken,
        max_emails,
        supabase,
        connection_id,
        user_id
      );

      console.log(`Processing ${messages.length} messages with AI...`);

      const contactsMap = await extractContactsWithAI(
        messages,
        openaiApiKey,
        supabase,
        connection_id,
        user_id
      );

      console.log(`Extracted ${contactsMap.size} unique contacts`);

      const contacts = Array.from(contactsMap.values()).map(contact => ({
        ...contact,
        emailIds: contact.emailIds.join('; '),
      }));

      const filteredContacts = contacts.filter(c =>
        c.companyName && c.companyName.length > 2 && c.confidence >= 0.5
      );

      console.log(`Returning ${filteredContacts.length} high-quality contacts`);

      return new Response(
        JSON.stringify({
          success: true,
          total_emails_scanned: messages.length,
          total_contacts: filteredContacts.length,
          contacts: filteredContacts,
          message: `Scanned ${messages.length} NEW emails and found ${filteredContacts.length} unique contacts`
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (gmailError: any) {
      if (gmailError.message.includes('401')) {
        console.log('Access token expired, attempting to refresh...');

        const { data: connection } = await supabase
          .from('gmail_connections')
          .select('refresh_token')
          .eq('id', connection_id)
          .eq('user_id', user_id)
          .maybeSingle();

        if (connection && connection.refresh_token) {
          const clientId = Deno.env.get('GMAIL_CLIENT_ID');
          const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

          if (!clientId || !clientSecret) {
            throw new Error('Gmail OAuth credentials not configured');
          }

          const refreshResult = await refreshAccessToken(
            connection.refresh_token,
            clientId,
            clientSecret
          );

          if (refreshResult) {
            const expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString();

            await supabase
              .from('gmail_connections')
              .update({
                access_token: refreshResult.accessToken,
                access_token_expires_at: expiresAt,
              })
              .eq('id', connection_id);

            console.log('Token refreshed, retrying with AI extraction...');
            const messages = await fetchGmailMessages(
              refreshResult.accessToken,
              max_emails,
              supabase,
              connection_id,
              user_id
            );

            const contactsMap = await extractContactsWithAI(
              messages,
              openaiApiKey,
              supabase,
              connection_id,
              user_id
            );

            const contacts = Array.from(contactsMap.values()).map(contact => ({
              ...contact,
              emailIds: contact.emailIds.join('; '),
            }));

            const filteredContacts = contacts.filter(c =>
              c.companyName && c.companyName.length > 2 && c.confidence >= 0.5
            );

            return new Response(
              JSON.stringify({
                success: true,
                total_emails_scanned: messages.length,
                total_contacts: filteredContacts.length,
                contacts: filteredContacts,
                message: `Scanned ${messages.length} NEW emails and found ${filteredContacts.length} unique contacts`
              }),
              {
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                },
              }
            );
          }
        }

        throw new Error('Access token expired. Please reconnect Gmail in Settings.');
      }

      throw gmailError;
    }
  } catch (error: any) {
    console.error('Error in extract-gmail-contacts:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
        success: false
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
