import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const INTERNAL_DOMAINS = ['anzen.co.in', 'shubham.co.in', 'shubham.com'];
const INTERNAL_EMAILS = ['lunkad.v@gmail.com', 'sumathi.lunkad@gmail.com'];

interface EmailAddress {
  email: string;
  name?: string;
  field?: string;
}

interface ExtractedContact {
  companyName: string;
  customerName: string;
  emailIds: string[];
  phone: string;
  mobile: string;
  website: string;
  address: string;
  source: string;
}

function isInternalEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase();

  if (INTERNAL_EMAILS.some(internal => lowerEmail === internal.toLowerCase())) {
    return true;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  return INTERNAL_DOMAINS.some(internalDomain => domain === internalDomain);
}

function extractPhoneNumber(text: string): string[] {
  const phoneRegex = /(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(phone => phone.trim());
}

function extractWebsite(text: string): string[] {
  const urlRegex = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const matches = text.match(urlRegex) || [];
  return matches.filter(url => !url.includes('@') && !url.includes('gmail.com') && !url.includes('yahoo.com'));
}

function extractCompanyFromDomain(email: string): string {
  const domain = email.split('@')[1];
  if (!domain || domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook')) {
    return '';
  }

  const companyName = domain.split('.')[0];
  let formatted = companyName
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  if (domain.endsWith('.co.id') && !formatted.toLowerCase().startsWith('pt')) {
    formatted = 'PT ' + formatted;
  }

  return formatted;
}

function extractNameFromEmail(email: string): string {
  const namePart = email.split('@')[0];
  return namePart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseSignature(text: string): { name?: string; company?: string; phone?: string; mobile?: string; website?: string; address?: string } {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let name = '';
  let company = '';
  let phone = '';
  let mobile = '';
  let website = '';
  let address = '';

  const invalidPatterns = [
    /^-+$/,
    /forwarded message/i,
    /original message/i,
    /^from:/i,
    /^to:/i,
    /^subject:/i,
    /^date:/i,
    /regards/i,
    /thanks/i,
    /^best/i,
    /sincerely/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    const isInvalid = invalidPatterns.some(pattern => pattern.test(line));
    if (isInvalid) continue;

    if (i === 0 && line.length < 50 && line.length > 2) {
      name = line;
    }

    if (lowerLine.includes('phone:') || lowerLine.includes('tel:') || lowerLine.includes('mobile:') || lowerLine.includes('cell:')) {
      const phones = extractPhoneNumber(line);
      if (lowerLine.includes('mobile') || lowerLine.includes('cell')) {
        mobile = phones[0] || '';
      } else {
        phone = phones[0] || '';
      }
    }

    if (lowerLine.includes('www.') || lowerLine.includes('http')) {
      const websites = extractWebsite(line);
      website = websites[0] || '';
    }

    if (lowerLine.includes('address:') || lowerLine.includes('location:')) {
      address = line.replace(/address:/gi, '').replace(/location:/gi, '').trim();
    }

    if (!company && line.length < 100 && i > 0 && i < 5) {
      const hasContact = lowerLine.includes('phone') || lowerLine.includes('email') || lowerLine.includes('www');
      if (!hasContact) {
        company = line;
      }
    }
  }

  return { name, company, phone, mobile, website, address };
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

async function fetchGmailMessages(accessToken: string, maxResults = 500): Promise<any[]> {
  const messages: any[] = [];
  let pageToken = '';

  try {
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

      if (!listData.nextPageToken) {
        break;
      }

      pageToken = listData.nextPageToken;
    }
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    throw error;
  }

  return messages;
}

function extractEmailAddresses(headers: any[]): EmailAddress[] {
  const addresses: EmailAddress[] = [];
  const fields = ['from', 'to', 'cc', 'bcc'];

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

function extractContacts(messages: any[]): Map<string, ExtractedContact> {
  const contactsMap = new Map<string, ExtractedContact>();

  for (const message of messages) {
    try {
      const headers = message.payload.headers;
      const addresses = extractEmailAddresses(headers);

      const fromAddresses = addresses.filter(addr => addr.field === 'from');

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

      const signature = parseSignature(body);
      const phones = extractPhoneNumber(body);
      const websites = extractWebsite(body);

      for (const addr of fromAddresses) {
        if (isInternalEmail(addr.email)) {
          continue;
        }
        if (addr.email.includes('noreply') || addr.email.includes('no-reply')) {
          continue;
        }

        const domain = addr.email.split('@')[1];
        const isGenericEmail = domain && (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook'));

        const companyKey = isGenericEmail ? addr.email : domain;

        let contact = contactsMap.get(companyKey);

        if (!contact) {
          contact = {
            companyName: signature.company || extractCompanyFromDomain(addr.email),
            customerName: signature.name || addr.name || extractNameFromEmail(addr.email),
            emailIds: [addr.email],
            phone: signature.phone || phones[0] || '',
            mobile: signature.mobile || phones[1] || '',
            website: signature.website || websites[0] || '',
            address: signature.address || '',
            source: 'Gmail',
          };
          contactsMap.set(companyKey, contact);
        } else {
          if (!contact.emailIds.includes(addr.email)) {
            contact.emailIds.push(addr.email);
          }

          if (!contact.customerName && (signature.name || addr.name)) {
            contact.customerName = signature.name || addr.name || contact.customerName;
          }

          if (!contact.companyName && signature.company) {
            contact.companyName = signature.company;
          }

          if (!contact.phone && (signature.phone || phones[0])) {
            contact.phone = signature.phone || phones[0] || '';
          }

          if (!contact.mobile && (signature.mobile || phones[1])) {
            contact.mobile = signature.mobile || phones[1] || '';
          }

          if (!contact.website && (signature.website || websites[0])) {
            contact.website = signature.website || websites[0] || '';
          }

          if (!contact.address && signature.address) {
            contact.address = signature.address;
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
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
    
    const { access_token, max_emails = 500, user_id, connection_id } = await req.json();

    if (!access_token) {
      console.error('No access token provided');
      return new Response(
        JSON.stringify({ error: 'Access token is required', success: false }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let currentAccessToken = access_token;

    console.log(`Fetching up to ${max_emails} emails...`);
    
    try {
      const messages = await fetchGmailMessages(currentAccessToken, max_emails);
      console.log(`Fetched ${messages.length} messages`);
      
      const contactsMap = extractContacts(messages);
      console.log(`Extracted ${contactsMap.size} contacts`);

      const contacts = Array.from(contactsMap.values()).map(contact => ({
        ...contact,
        emailIds: contact.emailIds.join('; '),
      }));

      const filteredContacts = contacts.filter(c =>
        c.companyName || c.customerName || c.emailIds.length > 0
      );

      console.log(`Returning ${filteredContacts.length} filtered contacts`);

      return new Response(
        JSON.stringify({
          success: true,
          total_emails: messages.length,
          total_contacts: filteredContacts.length,
          contacts: filteredContacts,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (gmailError: any) {
      if (gmailError.message.includes('401') && user_id && connection_id) {
        console.log('Access token expired, attempting to refresh...');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

            console.log('Token refreshed, retrying Gmail API...');
            const messages = await fetchGmailMessages(refreshResult.accessToken, max_emails);
            console.log(`Fetched ${messages.length} messages after token refresh`);
            
            const contactsMap = extractContacts(messages);
            console.log(`Extracted ${contactsMap.size} contacts`);

            const contacts = Array.from(contactsMap.values()).map(contact => ({
              ...contact,
              emailIds: contact.emailIds.join('; '),
            }));

            const filteredContacts = contacts.filter(c =>
              c.companyName || c.customerName || c.emailIds.length > 0
            );

            console.log(`Returning ${filteredContacts.length} filtered contacts`);

            return new Response(
              JSON.stringify({
                success: true,
                total_emails: messages.length,
                total_contacts: filteredContacts.length,
                contacts: filteredContacts,
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
