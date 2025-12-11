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

function extractPhoneNumber(text: string): string[] {
  const phoneRegex = /(\+?\d{1,4}[-\.\s]?)?(\(?\d{2,4}\)?[-\.\s]?)?\d{3,4}[-\.\s]?\d{3,4}/g;
  const matches = text.match(phoneRegex) || [];
  return matches.map(phone => phone.trim()).slice(0, 2);
}

function extractWebsite(text: string): string[] {
  const urlRegex = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const matches = text.match(urlRegex) || [];
  return matches.filter(url => !url.includes('@')).slice(0, 1);
}

function enrichCompanyFromDomain(domain: string): { companyName: string; website: string } {
  if (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook')) {
    return { companyName: '', website: '' };
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

  return { companyName, website: `www.${domain}` };
}

function extractFromSignature(emailBody: string): { name?: string; company?: string; phone?: string } {
  const lines = emailBody.split('\n').map(l => l.trim()).filter(l => l && l.length < 100);

  let name = '';
  let company = '';
  let phone = '';

  const invalidPatterns = /^(dear|hi|hello|regards|thanks|best|sincerely|thank you|mohon maaf|selamat|from:|to:|subject:)/i;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];

    if (invalidPatterns.test(line)) continue;

    if (!name && i < 3 && line.length > 2 && line.length < 50) {
      name = line;
    }

    if (!company && i > 0 && i < 5 && line.length > 2) {
      const hasContactInfo = /phone|email|www|@/.test(line.toLowerCase());
      if (!hasContactInfo) {
        company = line;
      }
    }

    const phones = extractPhoneNumber(line);
    if (phones.length > 0 && !phone) {
      phone = phones[0];
    }
  }

  return { name, company, phone };
}

function quickExtractContact(
  fromEmail: string,
  fromName: string | undefined,
  emailBody: string
): ExtractedContact {
  const domain = fromEmail.split('@')[1];
  const { companyName, website } = enrichCompanyFromDomain(domain);
  const signature = extractFromSignature(emailBody);
  const phones = extractPhoneNumber(emailBody);
  const websites = extractWebsite(emailBody);

  const finalCompany = signature.company || companyName || '';
  const finalName = signature.name || fromName || fromEmail.split('@')[0];
  const finalWebsite = websites[0] || website || '';

  return {
    companyName: finalCompany,
    customerName: finalName,
    emailIds: [fromEmail],
    phone: signature.phone || phones[0] || '',
    mobile: phones[1] || '',
    website: finalWebsite,
    address: '',
    source: 'Gmail',
    confidence: finalCompany && finalCompany.length > 2 ? 0.7 : 0.4
  };
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
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
      return null;
    }

    const data = await response.json();
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
    console.log(`Already processed ${processedIds.size} messages`);

    while (messages.length < maxResults) {
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`;

      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!listResponse.ok) {
        throw new Error(`Gmail API error: ${listResponse.status}`);
      }

      const listData = await listResponse.json();

      if (!listData.messages || listData.messages.length === 0) {
        break;
      }

      for (const message of listData.messages) {
        if (processedIds.has(message.id)) {
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

    console.log(`Fetched ${messages.length} NEW messages`);
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    throw error;
  }

  return messages;
}

function extractEmailAddresses(headers: any[]): { email: string; name?: string; field: string }[] {
  const addresses: { email: string; name?: string; field: string }[] = [];
  const fields = ['from'];

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
          name: nameMatch ? nameMatch[1].trim().replace(/\"/g, '') : undefined,
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

  return body.substring(0, 5000);
}

async function extractContacts(
  messages: any[],
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

      if (addresses.length === 0) {
        processedMessageIds.push(message.id);
        continue;
      }

      const fromAddr = addresses[0];

      if (isInternalEmail(fromAddr.email)) {
        processedMessageIds.push(message.id);
        continue;
      }

      if (fromAddr.email.includes('noreply') || fromAddr.email.includes('no-reply')) {
        processedMessageIds.push(message.id);
        continue;
      }

      const body = getEmailBody(message);
      const contact = quickExtractContact(fromAddr.email, fromAddr.name, body);

      if (contact.confidence >= 0.5) {
        const domain = fromAddr.email.split('@')[1];
        const isGenericEmail = domain && (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail') || domain.includes('outlook'));
        const companyKey = isGenericEmail ? fromAddr.email : domain;

        const existing = contactsMap.get(companyKey);
        if (existing) {
          if (!existing.emailIds.includes(fromAddr.email)) {
            existing.emailIds.push(fromAddr.email);
          }
          existing.confidence = Math.max(existing.confidence, contact.confidence);
        } else {
          contactsMap.set(companyKey, contact);
        }
      }

      processedMessageIds.push(message.id);
    } catch (error) {
      console.error('Error processing message:', error);
      processedMessageIds.push(message.id);
    }
  }

  if (processedMessageIds.length > 0) {
    try {
      await supabase
        .from('gmail_processed_messages')
        .insert(
          processedMessageIds.map(msgId => ({
            user_id: userId,
            connection_id: connectionId,
            gmail_message_id: msgId,
            contacts_extracted: contactsMap.size > 0 ? 1 : 0,
            extraction_data: null
          }))
        );
    } catch (dbError) {
      console.error('Error saving processed messages:', dbError);
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

    const { access_token, max_emails = 50, user_id, connection_id } = await req.json();

    if (!access_token || !user_id || !connection_id) {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing up to ${max_emails} emails...`);

    const messages = await fetchGmailMessages(
      access_token,
      Math.min(max_emails, 100),
      supabase,
      connection_id,
      user_id
    );

    console.log(`Extracting contacts from ${messages.length} messages...`);

    const contactsMap = await extractContacts(
      messages,
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

    console.log(`Returning ${filteredContacts.length} contacts`);

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
  } catch (error: any) {
    console.error('Error in extract-gmail-contacts:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while extracting contacts',
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
