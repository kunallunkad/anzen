import { useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface ChallanItem {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  pack_size: number | null;
  pack_type: string | null;
  number_of_packs: number | null;
  products?: {
    product_name: string;
    product_code: string;
  };
  batches?: {
    batch_number: string;
    expiry_date: string | null;
    packaging_details: string | null;
  };
}

interface DeliveryChallanViewProps {
  challan: {
    id: string;
    challan_number: string;
    customer_id: string;
    challan_date: string;
    delivery_address: string;
    vehicle_number: string | null;
    driver_name: string | null;
    status: string;
    notes: string | null;
    customers?: {
      company_name: string;
      address: string;
      city: string;
      phone: string;
    };
  };
  items: ChallanItem[];
  onClose: () => void;
  companySettings?: {
    company_name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    website: string;
    npwp: string;
    logo_url: string | null;
  } | null;
}

export function DeliveryChallanView({ challan, items, onClose, companySettings }: DeliveryChallanViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75 print:bg-white print:relative print:overflow-visible">
      <div className="flex min-h-screen items-start justify-center p-4 pt-10 print:p-0 print:block">
        <div className="relative w-full max-w-5xl bg-white shadow-xl print:shadow-none print:max-w-full">
          {/* Action Buttons - Hidden on print */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 print:hidden">
            <h2 className="text-xl font-bold text-gray-900">
              Delivery Challan {challan.challan_number}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Challan Content */}
          <div ref={printRef} className="p-8 print:p-4">
            {/* Header Section - Company Details */}
            <div className="mb-3 border-2 border-black p-3 print:mb-2 print:p-2">
              <div className="mb-2 flex items-start justify-between">
                {/* Company Logo and Info */}
                <div className="flex items-start gap-3">
                  {companySettings?.logo_url && (
                    <img
                      src={companySettings.logo_url}
                      alt="Company Logo"
                      className="h-16 w-16 object-contain print:h-12 print:w-12"
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 print:text-lg">
                      {companySettings?.company_name || 'PT. SHUBHAM ANZEN PHARMA JAYA'}
                    </h1>
                    <p className="text-xs text-gray-600 print:text-[10px]">
                      {companySettings?.address || 'Jl. Raya Cikarang Cibarusah No.10'}
                    </p>
                    <p className="text-xs text-gray-600 print:text-[10px]">
                      {companySettings?.city || 'Cikarang, Bekasi, Jawa Barat 17530'}
                    </p>
                    <p className="text-xs text-gray-600 print:text-[10px]">
                      Phone: {companySettings?.phone || '+62 21 1234 5678'} | Email: {companySettings?.email || 'info@shubhamanzen.com'}
                    </p>
                    {companySettings?.npwp && (
                      <p className="text-xs text-gray-600 print:text-[10px]">
                        NPWP: {companySettings.npwp}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 border-t border-gray-300 pt-2 print:mt-1 print:pt-1">
                <h2 className="text-center text-lg font-bold text-gray-900 print:text-base">
                  DELIVERY CHALLAN
                </h2>
              </div>
            </div>

            {/* Challan Info and Customer Details */}
            <div className="mb-3 grid grid-cols-2 gap-4 print:mb-2 print:gap-2">
              {/* Left: Customer Details */}
              <div className="border border-black p-2 print:p-1.5">
                <h3 className="mb-1 text-sm font-bold text-gray-900 print:text-xs">Delivered To:</h3>
                <div className="text-xs text-gray-700 print:text-[10px]">
                  <p className="font-semibold">{challan.customers?.company_name}</p>
                  <p>{challan.delivery_address}</p>
                  <p>{challan.customers?.city}</p>
                  {challan.customers?.phone && <p>Phone: {challan.customers.phone}</p>}
                </div>
              </div>

              {/* Right: Challan Details */}
              <div className="border border-black p-2 print:p-1.5">
                <div className="space-y-1 text-xs print:text-[10px]">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Challan No:</span>
                    <span className="text-gray-700">{challan.challan_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Date:</span>
                    <span className="text-gray-700">{formatDate(challan.challan_date)}</span>
                  </div>
                  {challan.vehicle_number && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-900">Vehicle No:</span>
                      <span className="text-gray-700">{challan.vehicle_number}</span>
                    </div>
                  )}
                  {challan.driver_name && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-900">Driver:</span>
                      <span className="text-gray-700">{challan.driver_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-3 border border-black print:mb-2">
              <table className="w-full text-xs print:text-[10px]">
                <thead>
                  <tr className="border-b border-black bg-gray-100">
                    <th className="border-r border-black p-2 text-left font-bold print:p-1">No</th>
                    <th className="border-r border-black p-2 text-left font-bold print:p-1">Product Code</th>
                    <th className="border-r border-black p-2 text-left font-bold print:p-1">Product Name</th>
                    <th className="border-r border-black p-2 text-left font-bold print:p-1">Batch</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1">Expiry</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1">Pack Type</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1">Packs</th>
                    <th className="p-2 text-right font-bold print:p-1">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-300 last:border-b-0">
                      <td className="border-r border-black p-2 print:p-1">{index + 1}</td>
                      <td className="border-r border-black p-2 print:p-1">{item.products?.product_code}</td>
                      <td className="border-r border-black p-2 print:p-1">{item.products?.product_name}</td>
                      <td className="border-r border-black p-2 print:p-1">{item.batches?.batch_number}</td>
                      <td className="border-r border-black p-2 text-center print:p-1">
                        {item.batches?.expiry_date ? formatDate(item.batches.expiry_date) : '-'}
                      </td>
                      <td className="border-r border-black p-2 text-center print:p-1">
                        {item.pack_type && item.pack_size ? `${item.pack_size} ${item.pack_type}` : '-'}
                      </td>
                      <td className="border-r border-black p-2 text-center print:p-1">
                        {item.number_of_packs || '-'}
                      </td>
                      <td className="p-2 text-right print:p-1">{item.quantity}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-black bg-gray-50 font-bold">
                    <td colSpan={7} className="border-r border-black p-2 text-right print:p-1">
                      Total Quantity:
                    </td>
                    <td className="p-2 text-right print:p-1">{totalQuantity}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes */}
            {challan.notes && (
              <div className="mb-3 border border-black p-2 print:mb-2 print:p-1.5">
                <p className="text-xs font-semibold text-gray-900 print:text-[10px]">Notes:</p>
                <p className="text-xs text-gray-700 print:text-[10px]">{challan.notes}</p>
              </div>
            )}

            {/* Signature Section */}
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-300 pt-4 print:mt-4 print:gap-2 print:pt-2">
              <div className="text-center">
                <div className="mb-12 text-xs font-semibold print:mb-8 print:text-[10px]">Prepared By</div>
                <div className="border-t border-gray-400 pt-1 text-xs print:text-[10px]">Signature & Date</div>
              </div>
              <div className="text-center">
                <div className="mb-12 text-xs font-semibold print:mb-8 print:text-[10px]">Delivered By</div>
                <div className="border-t border-gray-400 pt-1 text-xs print:text-[10px]">Signature & Date</div>
              </div>
              <div className="text-center">
                <div className="mb-12 text-xs font-semibold print:mb-8 print:text-[10px]">Received By</div>
                <div className="border-t border-gray-400 pt-1 text-xs print:text-[10px]">Signature & Date</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          * {
            page-break-inside: avoid !important;
          }
          table {
            page-break-inside: avoid !important;
          }
          div {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
