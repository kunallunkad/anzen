import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';

interface DeliveryChallan {
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
}

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

export function DeliveryChallanView() {
  const { setCurrentPage } = useNavigation();
  const [challan, setChallan] = useState<DeliveryChallan | null>(null);
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [challanId, setChallanId] = useState<string | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem('viewChallanId');
    if (id) {
      setChallanId(id);
      loadChallanData(id);
    } else {
      setCurrentPage('delivery-challan');
    }
  }, []);

  const loadChallanData = async (id: string) => {
    try {
      const { data: challanData, error: challanError } = await supabase
        .from('delivery_challans')
        .select('*, customers(company_name, address, city, phone)')
        .eq('id', id)
        .single();

      if (challanError) throw challanError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('delivery_challan_items')
        .select('*, products(product_name, product_code), batches(batch_number, expiry_date, packaging_details)')
        .eq('challan_id', id);

      if (itemsError) throw itemsError;

      setChallan(challanData);
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error loading challan:', error);
      alert('Failed to load delivery challan');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!challan) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Delivery Challan not found</p>
          <button
            onClick={() => setCurrentPage('delivery-challan')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to List
          </button>
        </div>
      </Layout>
    );
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Layout>
      <div className="space-y-6 print:block">
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={() => {
              sessionStorage.removeItem('viewChallanId');
              setCurrentPage('delivery-challan');
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to List
          </button>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none print:p-4">
          {/* Header Section - Company Details */}
          <div className="mb-3 border-2 border-black p-3 print:mb-2 print:p-2">
            <div className="mb-2 flex items-start justify-between">
              {/* Company Logo and Info */}
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 flex items-center justify-center print:h-12 print:w-12">
                  <img src="/src/assets/Untitled-1.svg" alt="Company Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h1 className="text-base font-bold print:text-sm">PT. SHUBHAM ANZEN PHARMA JAYA</h1>
                  <p className="text-xs print:text-[10px]">Komplek Ruko Metro Sunter Blok A1 NO.15, Jl. Metro Indah Raya,</p>
                  <p className="text-xs print:text-[10px]">Kelurahan Papanggo, Kec. Tanjung Priok, Jakarta Utara - 14340</p>
                  <p className="text-xs print:text-[10px]">Telp: (+62 21) 65832426</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-right">
                <h2 className="text-3xl font-bold print:text-2xl">SURAT JALAN</h2>
                <p className="text-sm text-gray-600 mt-1 print:text-xs">Delivery Order</p>
              </div>
            </div>

            {/* Company Licenses */}
            <div className="text-xs space-y-0.5 print:text-[10px] print:space-y-0">
              <div>
                <span className="font-semibold">No izin PBF</span>
                <span className="ml-16">: 27092400534390007</span>
              </div>
              <div>
                <span className="font-semibold">No Sertifikasi CDOB</span>
                <span className="ml-4">: 270924005343900070001</span>
              </div>
            </div>
          </div>

          {/* Customer and Delivery Details */}
          <div className="mb-3 border-2 border-black p-3 print:mb-2 print:p-2">
            <div className="flex justify-between">
              {/* Left - Customer Details */}
              <div className="space-y-1 text-xs print:text-[10px] print:space-y-0 flex-1">
                <div>
                  <span className="font-bold">Company Name:</span>
                </div>
                <div className="ml-4 mb-1">
                  <p className="font-semibold">{challan.customers?.company_name || ''}</p>
                </div>
                <div className="pt-1">
                  <span className="font-bold">Delivery Address:</span>
                </div>
                <div className="ml-4">
                  <p>{challan.delivery_address}</p>
                </div>
                {challan.customers?.phone && (
                  <div className="flex pt-1">
                    <span className="font-bold w-20">Phone:</span>
                    <span>{challan.customers.phone}</span>
                  </div>
                )}
              </div>

              {/* Right - Delivery Details */}
              <div className="space-y-1 text-xs print:text-[10px] print:space-y-0 text-right" style={{minWidth: '200px'}}>
                <div>
                  <span className="font-bold">DO Number:</span>
                  <span className="ml-2">{challan.challan_number}</span>
                </div>
                <div>
                  <span className="font-bold">Date:</span>
                  <span className="ml-2">{formatDate(challan.challan_date)}</span>
                </div>
                {challan.vehicle_number && (
                  <div className="pt-1">
                    <span className="font-bold">Vehicle No:</span>
                    <span className="ml-2">{challan.vehicle_number}</span>
                  </div>
                )}
                {challan.driver_name && (
                  <div>
                    <span className="font-bold">Driver:</span>
                    <span className="ml-2">{challan.driver_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full border-2 border-black text-xs print:text-[10px]">
              <thead>
                <tr className="border-b-2 border-black bg-white">
                  <th className="border-r border-black p-1.5 text-center font-bold print:p-1">No.</th>
                  <th className="border-r border-black p-1.5 text-left font-bold print:p-1">Product Name</th>
                  <th className="border-r border-black p-1.5 text-center font-bold print:p-1">Batch No.</th>
                  <th className="border-r border-black p-1.5 text-center font-bold print:p-1">Exp. Date</th>
                  <th className="border-r border-black p-1.5 text-center font-bold print:p-1">Packaging</th>
                  <th className="border-r border-black p-1.5 text-center font-bold print:p-1">No. of Packs</th>
                  <th className="p-1.5 text-right font-bold print:p-1">Total Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-black">
                    <td className="border-r border-black p-1.5 text-center print:p-1">{index + 1}</td>
                    <td className="border-r border-black p-1.5 print:p-1">
                      <div className="font-medium">{item.products?.product_name}</div>
                      <div className="text-[10px] text-gray-600 print:text-[9px]">{item.products?.product_code}</div>
                    </td>
                    <td className="border-r border-black p-1.5 text-center print:p-1">{item.batches?.batch_number}</td>
                    <td className="border-r border-black p-1.5 text-center print:p-1">
                      {item.batches?.expiry_date ? formatDate(item.batches.expiry_date) : '-'}
                    </td>
                    <td className="border-r border-black p-1.5 text-center print:p-1">
                      {item.pack_size && item.pack_type
                        ? `${item.pack_size} kg ${item.pack_type}`
                        : item.batches?.packaging_details || '-'}
                    </td>
                    <td className="border-r border-black p-1.5 text-center print:p-1">
                      {item.number_of_packs || '-'}
                    </td>
                    <td className="p-1.5 text-right font-medium print:p-1">
                      {item.quantity.toFixed(2)} kg
                    </td>
                  </tr>
                ))}
                {/* Empty rows for spacing */}
                {items.length < 2 && Array.from({ length: 2 - items.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-black">
                    <td className="border-r border-black p-1.5 text-center print:p-1">&nbsp;</td>
                    <td className="border-r border-black p-1.5 print:p-1">&nbsp;</td>
                    <td className="border-r border-black p-1.5 print:p-1">&nbsp;</td>
                    <td className="border-r border-black p-1.5 print:p-1">&nbsp;</td>
                    <td className="border-r border-black p-1.5 print:p-1">&nbsp;</td>
                    <td className="border-r border-black p-1.5 print:p-1">&nbsp;</td>
                    <td className="p-1.5 print:p-1">&nbsp;</td>
                  </tr>
                ))}
                <tr className="bg-white font-semibold">
                  <td colSpan={6} className="border-r border-black p-1.5 text-right print:p-1">
                    TOTAL QUANTITY:
                  </td>
                  <td className="p-1.5 text-right font-bold print:p-1">
                    {totalQuantity.toFixed(2)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Additional Notes */}
          {challan.notes && (
            <div className="mt-3 border-2 border-black p-2 print:mt-2 print:p-1.5">
              <p className="text-xs print:text-[10px]">
                <span className="font-bold">Remarks: </span>
                <span>{challan.notes}</span>
              </p>
            </div>
          )}

          {/* Signatures */}
          <div className="mt-4 grid grid-cols-3 gap-8 text-xs print:mt-2 print:text-[10px] print:gap-6">
            <div>
              <p className="font-semibold mb-1">Prepared By:</p>
              <p className="font-semibold mb-10 print:mb-8">Warehouse</p>
              <div className="w-4/5 border-t border-black pt-1">(Signature & Full Name)</div>
            </div>
            <div>
              <p className="font-semibold mb-1">Checked By:</p>
              <p className="font-semibold mb-10 print:mb-8">QC / Supervisor</p>
              <div className="w-4/5 border-t border-black pt-1">(Signature & Full Name)</div>
            </div>
            <div>
              <p className="font-semibold mb-1">Received By:</p>
              <p className="font-semibold mb-10 print:mb-8">{challan.customers?.company_name || 'Customer'}</p>
              <div className="w-4/5 border-t border-black pt-1">(Signature & Full Name)</div>
              <p className="mt-2 font-semibold print:mt-1">Date Received:</p>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-gray-500 print:mt-4">
            <p>This is a computer-generated document.</p>
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
    </Layout>
  );
}
