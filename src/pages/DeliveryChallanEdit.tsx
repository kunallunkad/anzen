import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
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
    current_stock: number;
  };
}

export function DeliveryChallanEdit() {
  const { setCurrentPage } = useNavigation();
  const [challan, setChallan] = useState<DeliveryChallan | null>(null);
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [challanId, setChallanId] = useState<string | null>(null);
  const [originalItems, setOriginalItems] = useState<ChallanItem[]>([]);

  useEffect(() => {
    const id = sessionStorage.getItem('editChallanId');
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
        .select('*')
        .eq('id', id)
        .single();

      if (challanError) throw challanError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('delivery_challan_items')
        .select('*, products(product_name, product_code), batches(batch_number, expiry_date, packaging_details, current_stock)')
        .eq('challan_id', id);

      if (itemsError) throw itemsError;

      setChallan(challanData);
      setItems(itemsData || []);
      setOriginalItems(JSON.parse(JSON.stringify(itemsData || [])));
    } catch (error) {
      console.error('Error loading challan:', error);
      alert('Failed to load delivery challan');
    } finally {
      setLoading(false);
    }
  };

  const handleChallanChange = (field: string, value: any) => {
    if (challan) {
      setChallan({ ...challan, [field]: value });
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'number_of_packs' && newItems[index].pack_size) {
      newItems[index].quantity = newItems[index].pack_size! * value;
    }

    setItems(newItems);
  };

  const handleSave = async () => {
    if (!challan || !challanId) return;

    try {
      setSaving(true);

      const { error: challanError } = await supabase
        .from('delivery_challans')
        .update({
          vehicle_number: challan.vehicle_number,
          driver_name: challan.driver_name,
          notes: challan.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', challanId);

      if (challanError) throw challanError;

      for (const item of items) {
        const originalItem = originalItems.find(i => i.id === item.id);

        if (originalItem && originalItem.quantity !== item.quantity) {
          const quantityDiff = item.quantity - originalItem.quantity;

          const batch = item.batches;
          if (batch) {
            const newStock = batch.current_stock - quantityDiff;

            if (newStock < 0) {
              throw new Error(`Insufficient stock for ${item.products?.product_name}. Available: ${batch.current_stock} kg`);
            }

            const { error: batchError } = await supabase
              .from('batches')
              .update({ current_stock: newStock })
              .eq('id', item.batch_id);

            if (batchError) throw batchError;
          }
        }

        const { error: itemError } = await supabase
          .from('delivery_challan_items')
          .update({
            quantity: item.quantity,
            number_of_packs: item.number_of_packs,
          })
          .eq('id', item.id);

        if (itemError) throw itemError;
      }

      alert('Delivery Challan updated successfully');
      sessionStorage.removeItem('editChallanId');
      setCurrentPage('delivery-challan');
    } catch (error: any) {
      console.error('Error saving challan:', error);
      alert(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              sessionStorage.removeItem('editChallanId');
              setCurrentPage('delivery-challan');
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to List
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Delivery Challan</h1>
            <p className="text-gray-600 mt-1">DO Number: {challan.challan_number}</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number</label>
                <input
                  type="text"
                  value={challan.vehicle_number || ''}
                  onChange={(e) => handleChallanChange('vehicle_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., B 1234 XYZ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
                <input
                  type="text"
                  value={challan.driver_name || ''}
                  onChange={(e) => handleChallanChange('driver_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Driver's name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Remarks / Notes</label>
              <textarea
                value={challan.notes || ''}
                onChange={(e) => handleChallanChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes or remarks"
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
                        <div className="text-sm font-medium text-gray-900">{item.products?.product_name}</div>
                        <div className="text-xs text-gray-500">{item.products?.product_code}</div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                        <div className="text-sm text-gray-900">{item.batches?.batch_number}</div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Available Stock</label>
                        <div className="text-sm font-medium text-gray-900">
                          {item.batches?.current_stock} kg
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">No. of Packs</label>
                        <input
                          type="number"
                          value={item.number_of_packs || ''}
                          onChange={(e) => handleItemChange(index, 'number_of_packs', e.target.value ? Number(e.target.value) : null)}
                          min="1"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Total Qty (kg)</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {item.pack_size && (
                      <div className="mt-2 text-xs text-gray-600">
                        Pack Size: {item.pack_size} kg {item.pack_type} |
                        Calculation: {item.pack_size} kg × {item.number_of_packs || 0} = {item.quantity} kg
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Quantity:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {items.reduce((sum, item) => sum + item.quantity, 0).toFixed(2)} kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
