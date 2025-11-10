import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer, Edit } from 'lucide-react';
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

  const handleEdit = () => {
    if (challanId) {
      sessionStorage.setItem('editChallanId', challanId);
      setCurrentPage('delivery-challan-edit');
    }
  };

  const handlePrint = () => {
    window.print();
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
      <div className="space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={() => setCurrentPage('delivery-challan')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to List
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none">
          <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
            <h1 className="text-3xl font-bold text-gray-900">SURAT JALAN</h1>
            <p className="text-lg text-gray-600 mt-1">Delivery Order</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase border-b border-gray-300 pb-1">
                Customer Details
              </h3>
              <div className="space-y-1.5 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">{challan.customers?.company_name}</span>
                </div>
                <div className="text-gray-700">{challan.customers?.address}</div>
                <div className="text-gray-700">{challan.customers?.city}</div>
                {challan.customers?.phone && (
                  <div className="text-gray-700">Tel: {challan.customers.phone}</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase border-b border-gray-300 pb-1">
                Delivery Information
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex">
                  <span className="font-medium text-gray-600 w-32">DO Number:</span>
                  <span className="font-bold text-gray-900">{challan.challan_number}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-600 w-32">Date:</span>
                  <span className="text-gray-900">{new Date(challan.challan_date).toLocaleDateString()}</span>
                </div>
                {challan.vehicle_number && (
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-32">Vehicle No:</span>
                    <span className="text-gray-900">{challan.vehicle_number}</span>
                  </div>
                )}
                {challan.driver_name && (
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-32">Driver:</span>
                    <span className="text-gray-900">{challan.driver_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase border-b border-gray-300 pb-1">
              Delivery Address
            </h3>
            <p className="text-sm text-gray-900">{challan.delivery_address}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">Items Delivered</h3>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Batch No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Exp Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Packaging</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">No. of Packs</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{item.products?.product_name}</div>
                        <div className="text-xs text-gray-500">{item.products?.product_code}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.batches?.batch_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.batches?.expiry_date ? new Date(item.batches.expiry_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.pack_size && item.pack_type
                          ? `${item.pack_size} kg ${item.pack_type}`
                          : item.batches?.packaging_details || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {item.number_of_packs || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {item.quantity.toFixed(2)} kg
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={6} className="px-4 py-3 text-sm text-gray-900 text-right">
                      TOTAL QUANTITY:
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                      {totalQuantity.toFixed(2)} kg
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {challan.notes && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">Remarks</h3>
              <div className="bg-gray-50 border border-gray-300 rounded p-3 text-sm text-gray-900">
                {challan.notes}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t-2 border-gray-300">
            <div className="text-center">
              <div className="h-20 mb-2"></div>
              <div className="border-t-2 border-gray-800 pt-2">
                <p className="text-sm font-semibold text-gray-900">Prepared By</p>
                <p className="text-xs text-gray-600 mt-1">Warehouse</p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-20 mb-2"></div>
              <div className="border-t-2 border-gray-800 pt-2">
                <p className="text-sm font-semibold text-gray-900">Checked By</p>
                <p className="text-xs text-gray-600 mt-1">QC / Supervisor</p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-20 mb-2"></div>
              <div className="border-t-2 border-gray-800 pt-2">
                <p className="text-sm font-semibold text-gray-900">Received By</p>
                <p className="text-xs text-gray-600 mt-1">Customer</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-gray-500">
            <p>This is a computer-generated document.</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </Layout>
  );
}
