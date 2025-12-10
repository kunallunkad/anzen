import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Download, Upload, RefreshCw, CheckCircle, AlertCircle, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExtractedContact {
  companyName: string;
  customerName: string;
  emailIds: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  source: string;
}

export function ExtractData() {
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<ExtractedContact[]>([]);
  const [stats, setStats] = useState<{ total_emails: number; total_contacts: number } | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [maxEmails, setMaxEmails] = useState(500);

  const extractContactsFromGmail = async () => {
    setExtracting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Please log in to extract contacts.');
        return;
      }

      const { data: connection, error: connectionError } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_connected', true)
        .maybeSingle();

      if (connectionError && connectionError.code !== 'PGRST116') {
        console.error('Error fetching Gmail connection:', connectionError);
        alert('Error checking Gmail connection. Please try again.');
        return;
      }

      if (!connection || !connection.access_token) {
        alert('Gmail is not connected. Please connect Gmail first in Settings → Gmail tab.');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-gmail-contacts`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: connection.access_token,
          max_emails: maxEmails,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract contacts');
      }

      const result = await response.json();

      if (result.success) {
        setContacts(result.contacts);
        setStats({
          total_emails: result.total_emails,
          total_contacts: result.total_contacts,
        });
        setSelectedContacts(new Set(result.contacts.map((_: any, i: number) => i)));
      } else {
        throw new Error(result.error || 'Failed to extract contacts');
      }
    } catch (error) {
      console.error('Error extracting contacts:', error);
      alert('Failed to extract contacts. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const exportToExcel = () => {
    if (contacts.length === 0) {
      alert('No contacts to export');
      return;
    }

    const selectedData = contacts.filter((_, i) => selectedContacts.has(i));

    const worksheet = XLSX.utils.json_to_sheet(
      selectedData.map(contact => ({
        'Company Name': contact.companyName,
        'Customer Name': contact.customerName,
        'Email IDs': contact.emailIds,
        'Phone': contact.phone,
        'Mobile': contact.mobile,
        'Website': contact.website,
        'Address': contact.address,
        'Source': contact.source,
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

    const colWidths = [
      { wch: 30 },
      { wch: 25 },
      { wch: 40 },
      { wch: 18 },
      { wch: 18 },
      { wch: 30 },
      { wch: 40 },
      { wch: 12 },
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `Extracted_Contacts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const importToCustomers = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select contacts to import');
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to import ${selectedContacts.size} contact(s) to the Customers database?\n\nThis will create new customer records for selected contacts.`
    );

    if (!confirmed) return;

    setImporting(true);
    try {
      const selectedData = contacts.filter((_, i) => selectedContacts.has(i));

      const customersToInsert = selectedData.map(contact => ({
        company_name: contact.companyName || 'Unknown Company',
        contact_person: contact.customerName || '',
        email: contact.emailIds.split(';')[0]?.trim() || '',
        phone: contact.phone || contact.mobile || '',
        website: contact.website || '',
        address: contact.address || '',
        country: 'Indonesia',
        city: 'Jakarta Pusat',
        is_active: true,
      }));

      const { data, error } = await supabase
        .from('customers')
        .upsert(customersToInsert, {
          onConflict: 'email',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;

      alert(`Successfully imported ${data?.length || selectedContacts.size} customer(s)!`);
      setContacts([]);
      setStats(null);
      setSelectedContacts(new Set());
    } catch (error) {
      console.error('Error importing customers:', error);
      alert('Failed to import some customers. They may already exist in the database.');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((_, i) => i)));
    }
  };

  const toggleContact = (index: number) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedContacts(newSelected);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Extract Data from Gmail</h2>
        <p className="text-sm text-gray-600">
          Extract contact information from your Gmail inbox, sent emails, and CC/BCC recipients. The system will analyze email signatures, bodies, and headers to gather business contact details.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Emails to Scan
            </label>
            <input
              type="number"
              value={maxEmails}
              onChange={(e) => setMaxEmails(Math.max(100, Math.min(2000, parseInt(e.target.value) || 500)))}
              min="100"
              max="2000"
              step="100"
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Range: 100 - 2000 emails</p>
          </div>

          <div className="flex-shrink-0 pt-6">
            <button
              onClick={extractContactsFromGmail}
              disabled={extracting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {extracting ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5" />
                  Extract Contacts
                </>
              )}
            </button>
          </div>
        </div>

        {stats && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-900 font-medium">
                  Extraction completed successfully!
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Scanned {stats.total_emails} emails and found {stats.total_contacts} unique contacts
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {contacts.length > 0 && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-md font-semibold text-gray-900">
                  Extracted Contacts ({selectedContacts.size} selected)
                </h3>
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedContacts.size === contacts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportToExcel}
                  disabled={selectedContacts.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" />
                  Export to Excel
                </button>

                <button
                  onClick={importToCustomers}
                  disabled={importing || selectedContacts.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import to Customers
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedContacts.size === contacts.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Person</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email IDs</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Website</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact, index) => (
                    <tr
                      key={index}
                      className={`hover:bg-gray-50 ${selectedContacts.has(index) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(index)}
                          onChange={() => toggleContact(index)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{contact.companyName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{contact.customerName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={contact.emailIds}>
                        {contact.emailIds || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contact.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contact.mobile || '-'}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 max-w-xs truncate" title={contact.website}>
                        {contact.website || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-yellow-900 font-medium">
                  Review before importing
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please review the extracted contacts carefully. The system attempts to deduplicate and merge contacts from the same company, but you should verify the data before importing to your customer database.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
