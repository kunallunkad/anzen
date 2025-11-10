import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Trash2 } from 'lucide-react';

interface DeliveryChallan {
  id: string;
  challan_number: string;
  customer_id: string;
  challan_date: string;
  delivery_address: string;
  vehicle_number: string | null;
  driver_name: string | null;
  status: 'pending_invoice' | 'invoiced' | 'delivered';
  notes: string | null;
  customers?: {
    company_name: string;
    address: string;
    city: string;
  };
}

interface ChallanItem {
  id?: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  pack_size: number | null;
  pack_type: string | null;
  number_of_packs: number | null;
  products?: {
    product_name: string;
    product_code: string;
    unit: string;
  };
  batches?: {
    batch_number: string;
    expiry_date: string | null;
    current_stock: number;
    packaging_details: string | null;
  };
}

interface Customer {
  id: string;
  company_name: string;
  address: string;
  city: string;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  unit: string;
}

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  current_stock: number;
  expiry_date: string | null;
  packaging_details: string | null;
}

export function DeliveryChallan() {
  const { profile } = useAuth();
  const [challans, setChallans] = useState<DeliveryChallan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState<DeliveryChallan | null>(null);
  const [formData, setFormData] = useState({
    challan_number: '',
    customer_id: '',
    challan_date: new Date().toISOString().split('T')[0],
    delivery_address: '',
    vehicle_number: '',
    driver_name: '',
    notes: '',
  });
  const [items, setItems] = useState<Omit<ChallanItem, 'id'>[]>([{
    product_id: '',
    batch_id: '',
    quantity: 0,
    pack_size: null,
    pack_type: null,
    number_of_packs: null,
  }]);

  useEffect(() => {
    loadChallans();
    loadCustomers();
    loadProducts();
    loadBatches();
  }, []);

  const loadChallans = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_challans')
        .select('*, customers(company_name, address, city)')
        .order('challan_date', { ascending: false });

      if (error) throw error;
      setChallans(data || []);
    } catch (error) {
      console.error('Error loading challans:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNextChallanNumber = async () => {
    try {
      const prefix = 'DO';
      const currentYear = new Date().getFullYear().toString().slice(-2);

      const { data: latestChallan } = await supabase
        .from('delivery_challans')
        .select('challan_number')
        .like('challan_number', `${prefix}-${currentYear}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;

      if (latestChallan && latestChallan.challan_number) {
        const match = latestChallan.challan_number.match(/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[1], 10);
          nextNumber = lastNumber + 1;
        }
      }

      const paddedNumber = String(nextNumber).padStart(4, '0');
      return `${prefix}-${currentYear}-${paddedNumber}`;
    } catch (error) {
      console.error('Error generating challan number:', error);
      return 'DO-24-0001';
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, address, city')
        .eq('is_active', true)
        .order('company_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_name, product_code, unit')
        .eq('is_active', true)
        .order('product_name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, product_id, current_stock, expiry_date, packaging_details')
        .eq('is_active', true)
        .gt('current_stock', 0)
        .order('import_date', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        delivery_address: `${customer.address}, ${customer.city}`,
      });
    }
  };

  const handleBatchChange = (index: number, batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (batch) {
      const newItems = [...items];

      let packSize = null;
      let packType = null;
      let numberOfPacks = null;

      if (batch.packaging_details) {
        const match = batch.packaging_details.match(/(\d+)\s+(\w+)s?\s+x\s+(\d+(?:\.\d+)?)kg/i);
        if (match) {
          numberOfPacks = parseInt(match[1], 10);
          packType = match[2].toLowerCase();
          packSize = parseFloat(match[3]);
        }
      }

      newItems[index] = {
        ...newItems[index],
        batch_id: batchId,
        pack_size: packSize,
        pack_type: packType,
        number_of_packs: numberOfPacks || 1,
        quantity: packSize && numberOfPacks ? packSize * numberOfPacks : 0,
      };
      setItems(newItems);
    }
  };

  const updatePackQuantity = (index: number, packs: number) => {
    const newItems = [...items];
    const item = newItems[index];
    if (item.pack_size) {
      newItems[index] = {
        ...item,
        number_of_packs: packs,
        quantity: item.pack_size * packs,
      };
      setItems(newItems);
    }
  };

  const addItem = () => {
    setItems([...items, {
      product_id: '',
      batch_id: '',
      quantity: 0,
      pack_size: null,
      pack_type: null,
      number_of_packs: null,
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const challanData = {
        challan_number: formData.challan_number,
        customer_id: formData.customer_id,
        challan_date: formData.challan_date,
        delivery_address: formData.delivery_address,
        vehicle_number: formData.vehicle_number || null,
        driver_name: formData.driver_name || null,
        status: 'pending_invoice' as const,
        notes: formData.notes || null,
        created_by: user.id,
      };

      let challanId: string;

      if (editingChallan) {
        const { data: updatedChallan, error: updateError } = await supabase
          .from('delivery_challans')
          .update(challanData)
          .eq('id', editingChallan.id)
          .select()
          .single();

        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase
          .from('delivery_challan_items')
          .delete()
          .eq('challan_id', editingChallan.id);

        if (deleteItemsError) throw deleteItemsError;

        challanId = updatedChallan.id;
      } else {
        const { data: newChallan, error: challanError } = await supabase
          .from('delivery_challans')
          .insert([challanData])
          .select()
          .single();

        if (challanError) throw challanError;
        challanId = newChallan.id;
      }

      const challanItemsData = items.map(item => ({
        challan_id: challanId,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        pack_size: item.pack_size,
        pack_type: item.pack_type,
        number_of_packs: item.number_of_packs,
      }));

      const { error: itemsError } = await supabase
        .from('delivery_challan_items')
        .insert(challanItemsData);

      if (itemsError) throw itemsError;

      for (const item of items) {
        const batch = batches.find(b => b.id === item.batch_id);
        if (batch) {
          const { error: batchError } = await supabase
            .from('batches')
            .update({ current_stock: batch.current_stock - item.quantity })
            .eq('id', item.batch_id);

          if (batchError) throw batchError;
        }
      }

      setModalOpen(false);
      resetForm();
      loadChallans();
      loadBatches();
      alert('Delivery Challan created successfully!');
    } catch (error) {
      console.error('Error saving challan:', error);
      alert('Failed to save challan. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this delivery challan?')) return;

    try {
      const { error } = await supabase
        .from('delivery_challans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadChallans();
    } catch (error) {
      console.error('Error deleting challan:', error);
      alert('Failed to delete challan. Please try again.');
    }
  };

  const resetForm = () => {
    setEditingChallan(null);
    setFormData({
      challan_number: '',
      customer_id: '',
      challan_date: new Date().toISOString().split('T')[0],
      delivery_address: '',
      vehicle_number: '',
      driver_name: '',
      notes: '',
    });
    setItems([{
      product_id: '',
      batch_id: '',
      quantity: 0,
      pack_size: null,
      pack_type: null,
      number_of_packs: null,
    }]);
  };

  const columns = [
    { key: 'challan_number', label: 'DO Number' },
    {
      key: 'customer',
      label: 'Customer',
      render: (challan: DeliveryChallan) => (
        <div className="font-medium">{challan.customers?.company_name}</div>
      )
    },
    {
      key: 'challan_date',
      label: 'Date',
      render: (challan: DeliveryChallan) => new Date(challan.challan_date).toLocaleDateString()
    },
    {
      key: 'status',
      label: 'Status',
      render: (challan: DeliveryChallan) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          challan.status === 'invoiced' ? 'bg-green-100 text-green-800' :
          challan.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {challan.status === 'pending_invoice' ? 'Pending' : challan.status === 'invoiced' ? 'Invoiced' : 'Delivered'}
        </span>
      )
    },
  ];

  const canManage = profile?.role === 'admin' || profile?.role === 'accounts' || profile?.role === 'sales' || profile?.role === 'warehouse';

  const stats = {
    total: challans.length,
    pending: challans.filter(c => c.status === 'pending_invoice').length,
    invoiced: challans.filter(c => c.status === 'invoiced').length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Delivery Challan (Surat Jalan)</h1>
            <p className="text-gray-600 mt-1">Manage delivery orders and dispatch records</p>
          </div>
          {canManage && (
            <button
              onClick={async () => {
                resetForm();
                const nextChallanNumber = await generateNextChallanNumber();
                setFormData(prev => ({ ...prev, challan_number: nextChallanNumber }));
                setModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Create Delivery Challan
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Challans</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6">
            <p className="text-sm text-yellow-600">Pending Invoice</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <p className="text-sm text-green-600">Invoiced</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.invoiced}</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={challans}
          loading={loading}
          actions={canManage ? (challan) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(challan.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Delete Challan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : undefined}
        />

        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            resetForm();
          }}
          title={editingChallan ? "Edit Delivery Challan" : "Create Delivery Challan"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DO Number *
                </label>
                <input
                  type="text"
                  value={formData.challan_number}
                  onChange={(e) => setFormData({ ...formData, challan_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="DO-24-0001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Challan Date *
                </label>
                <input
                  type="date"
                  value={formData.challan_date}
                  onChange={(e) => setFormData({ ...formData, challan_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Address *
                </label>
                <textarea
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="B 1234 XYZ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={formData.driver_name}
                  onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Driver name"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Items to Dispatch</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const availableBatches = batches.filter(b => b.product_id === item.product_id);
                  const selectedBatch = batches.find(b => b.id === item.batch_id);

                  return (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Product *</label>
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[index] = { ...newItems[index], product_id: e.target.value, batch_id: '' };
                              setItems(newItems);
                            }}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Select Product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.product_name}</option>
                            ))}
                          </select>
                        </div>

                        {item.product_id && availableBatches.length > 0 && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Batch *</label>
                            <select
                              value={item.batch_id}
                              onChange={(e) => handleBatchChange(index, e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="">Select Batch</option>
                              {availableBatches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.batch_number} (Stock: {b.current_stock})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {selectedBatch && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Batch:</span>
                            <span className="font-medium">{selectedBatch.batch_number}</span>
                          </div>
                          {selectedBatch.expiry_date && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Expiry:</span>
                              <span className="font-medium">{new Date(selectedBatch.expiry_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {selectedBatch.packaging_details && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Packaging:</span>
                              <span className="font-medium">{selectedBatch.packaging_details}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Available Stock:</span>
                            <span className="font-medium">{selectedBatch.current_stock} kg</span>
                          </div>
                        </div>
                      )}

                      {item.pack_size && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">No. of Packs *</label>
                            <input
                              type="number"
                              value={item.number_of_packs || ''}
                              onChange={(e) => updatePackQuantity(index, Number(e.target.value))}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              required
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Pack Size</label>
                            <input
                              type="text"
                              value={`${item.pack_size} kg`}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100"
                              disabled
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Total Qty</label>
                            <input
                              type="text"
                              value={`${item.quantity} kg`}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100"
                              disabled
                            />
                          </div>
                        </div>
                      )}

                      {items.length > 1 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Remove Item
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create Challan
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
