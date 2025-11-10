import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { InvoiceView } from '../components/InvoiceView';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, FileText, Eye } from 'lucide-react';

interface SalesInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_status: 'pending' | 'partial' | 'paid';
  delivery_challan_number: string | null;
  po_number: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  customers?: {
    company_name: string;
    gst_vat_type: string;
  };
}

interface InvoiceItem {
  id?: string;
  product_id: string;
  batch_id: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
  products?: {
    product_name: string;
    product_code: string;
  };
  batches?: {
    batch_number: string;
  } | null;
}

interface Customer {
  id: string;
  company_name: string;
  gst_vat_type: string;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
}

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  current_stock: number;
}

export function Sales() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_terms: '30',
    discount: 0,
    delivery_challan_number: '',
    po_number: '',
    notes: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([{
    product_id: '',
    batch_id: null,
    quantity: 1,
    unit_price: 0,
    tax_rate: 11,
    total: 0,
  }]);

  useEffect(() => {
    loadInvoices();
    loadCustomers();
    loadProducts();
    loadBatches();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('*, customers(company_name, address, city, phone, npwp, pharmacy_license, gst_vat_type)')
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNextInvoiceNumber = async () => {
    try {
      // Get settings for invoice prefix
      const { data: settings } = await supabase
        .from('app_settings')
        .select('invoice_prefix, invoice_start_number')
        .maybeSingle();

      const prefix = settings?.invoice_prefix || 'SAPJ';
      const startNumber = settings?.invoice_start_number || 1;

      // Get the latest invoice number with this prefix
      const { data: latestInvoice } = await supabase
        .from('sales_invoices')
        .select('invoice_number')
        .like('invoice_number', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = startNumber;

      if (latestInvoice && latestInvoice.invoice_number) {
        // Extract the number part from the invoice number
        const match = latestInvoice.invoice_number.match(/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[1], 10);
          nextNumber = lastNumber + 1;
        }
      }

      // Format with leading zeros (minimum 3 digits)
      const paddedNumber = String(nextNumber).padStart(3, '0');
      return `${prefix}-${paddedNumber}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      return 'SAPJ-001';
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, gst_vat_type')
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
        .select('id, product_name, product_code')
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
        .select('id, batch_number, product_id, current_stock')
        .eq('is_active', true)
        .gt('current_stock', 0)
        .order('import_date', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  };

  const loadInvoiceItems = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select('*, products(product_name, product_code, unit), batches(batch_number, expiry_date)')
        .eq('invoice_id', invoiceId);

      if (error) throw error;
      setInvoiceItems(data || []);
      return data || [];
    } catch (error) {
      console.error('Error loading invoice items:', error);
      return [];
    }
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    const subtotal = item.quantity * item.unit_price;
    const tax = subtotal * (item.tax_rate / 100);
    return subtotal + tax;
  };

  const updateItemTotal = (index: number, updatedItem: InvoiceItem) => {
    const total = calculateItemTotal(updatedItem);
    const newItems = [...items];
    newItems[index] = { ...updatedItem, total };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      product_id: '',
      batch_id: null,
      quantity: 1,
      unit_price: 0,
      tax_rate: 11,
      total: 0,
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price;
      return sum + (itemSubtotal * (item.tax_rate / 100));
    }, 0);
    const total = subtotal + taxAmount - formData.discount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totals = calculateTotals();

      // Calculate due date based on payment terms
      const invoiceDate = new Date(formData.invoice_date);
      let dueDate = new Date(invoiceDate);
      let paymentTermsDays = 30;

      if (formData.payment_terms === 'advance' || formData.payment_terms === '50-50') {
        paymentTermsDays = 0;
      } else {
        paymentTermsDays = parseInt(formData.payment_terms);
        if (!isNaN(paymentTermsDays)) {
          dueDate.setDate(dueDate.getDate() + paymentTermsDays);
        }
      }

      let invoice;

      if (editingInvoice) {
        const oldItems = await loadInvoiceItems(editingInvoice.id);

        for (const oldItem of oldItems) {
          if (oldItem.batch_id) {
            const batch = batches.find(b => b.id === oldItem.batch_id);
            if (batch) {
              await supabase
                .from('batches')
                .update({ current_stock: batch.current_stock + oldItem.quantity })
                .eq('id', oldItem.batch_id);
            }
          }
        }

        const { data: updatedInvoice, error: updateError } = await supabase
          .from('sales_invoices')
          .update({
            invoice_number: formData.invoice_number,
            customer_id: formData.customer_id,
            invoice_date: formData.invoice_date,
            due_date: dueDate.toISOString().split('T')[0],
            discount_amount: formData.discount,
            delivery_challan_number: formData.delivery_challan_number || null,
            po_number: formData.po_number || null,
            payment_terms_days: paymentTermsDays,
            notes: formData.notes || null,
            subtotal: totals.subtotal,
            tax_amount: totals.taxAmount,
            total_amount: totals.total,
          })
          .eq('id', editingInvoice.id)
          .select()
          .single();

        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase
          .from('sales_invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice.id);

        if (deleteItemsError) throw deleteItemsError;

        invoice = updatedInvoice;
      } else {
        const { data: newInvoice, error: invoiceError } = await supabase
          .from('sales_invoices')
          .insert([{
            invoice_number: formData.invoice_number,
            customer_id: formData.customer_id,
            invoice_date: formData.invoice_date,
            due_date: dueDate.toISOString().split('T')[0],
            discount_amount: formData.discount,
            delivery_challan_number: formData.delivery_challan_number || null,
            po_number: formData.po_number || null,
            payment_terms_days: paymentTermsDays,
            notes: formData.notes || null,
            subtotal: totals.subtotal,
            tax_amount: totals.taxAmount,
            total_amount: totals.total,
            payment_status: 'pending',
            created_by: user.id,
          }])
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoice = newInvoice;
      }

      const invoiceItemsData = items.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
      }));

      const { error: itemsError } = await supabase
        .from('sales_invoice_items')
        .insert(invoiceItemsData);

      if (itemsError) throw itemsError;

      for (const item of items) {
        if (item.batch_id) {
          const batch = batches.find(b => b.id === item.batch_id);
          if (batch) {
            const { error: batchError } = await supabase
              .from('batches')
              .update({ current_stock: batch.current_stock - item.quantity })
              .eq('id', item.batch_id);

            if (batchError) throw batchError;
          }
        }

        const { error: txError } = await supabase
          .from('inventory_transactions')
          .insert([{
            transaction_type: 'sale',
            product_id: item.product_id,
            batch_id: item.batch_id || null,
            quantity: item.quantity,
            reference_number: formData.invoice_number,
            notes: `Sales invoice ${formData.invoice_number}`,
            transaction_date: formData.invoice_date,
            created_by: user.id,
          }]);

        if (txError) {
          console.error('Error creating inventory transaction:', txError);
          throw txError;
        }
      }

      setModalOpen(false);
      resetForm();
      loadInvoices();
      loadBatches();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice. Please try again.');
    }
  };

  const handleView = async (invoice: SalesInvoice) => {
    setSelectedInvoice(invoice);
    const items = await loadInvoiceItems(invoice.id);
    setViewModalOpen(true);
  };

  const handleEdit = async (invoice: SalesInvoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      invoice_date: invoice.invoice_date,
      payment_terms: String(invoice.payment_terms_days || 30),
      discount: invoice.discount_amount,
      delivery_challan_number: invoice.delivery_challan_number || '',
      po_number: invoice.po_number || '',
      notes: invoice.notes || '',
    });

    const loadedItems = await loadInvoiceItems(invoice.id);

    if (loadedItems.length > 0) {
      setItems(loadedItems.map(item => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total: item.total,
      })));
    }

    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('sales_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const updatePaymentStatus = async (invoice: SalesInvoice, newStatus: SalesInvoice['payment_status']) => {
    try {
      const { error } = await supabase
        .from('sales_invoices')
        .update({ payment_status: newStatus })
        .eq('id', invoice.id);

      if (error) throw error;
      loadInvoices();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status.');
    }
  };

  const resetForm = () => {
    setEditingInvoice(null);
    setFormData({
      invoice_number: '',
      customer_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      payment_terms: '30',
      discount: 0,
      delivery_challan_number: '',
      po_number: '',
      notes: '',
    });
    setItems([{
      product_id: '',
      batch_id: null,
      quantity: 1,
      unit_price: 0,
      tax_rate: 11,
      total: 0,
    }]);
  };

  const columns = [
    { key: 'invoice_number', label: 'Invoice #' },
    {
      key: 'customer',
      label: 'Customer',
      render: (inv: SalesInvoice) => (
        <div className="font-medium">{inv.customers?.company_name}</div>
      )
    },
    {
      key: 'invoice_date',
      label: 'Date',
      render: (inv: SalesInvoice) => new Date(inv.invoice_date).toLocaleDateString()
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (inv: SalesInvoice) => `Rp ${inv.total_amount.toLocaleString('id-ID')}`
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (inv: SalesInvoice) => (
        <select
          value={inv.payment_status}
          onChange={(e) => updatePaymentStatus(inv, e.target.value as any)}
          onClick={(e) => e.stopPropagation()}
          className={`px-2 py-1 rounded text-xs font-medium border-0 ${
            inv.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
            inv.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}
        >
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      )
    },
  ];

  const canManage = profile?.role === 'admin' || profile?.role === 'accounts' || profile?.role === 'sales';

  const stats = {
    total: invoices.length,
    totalRevenue: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    pending: invoices.filter(inv => inv.payment_status === 'pending').length,
    paid: invoices.filter(inv => inv.payment_status === 'paid').length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Invoices</h1>
            <p className="text-gray-600 mt-1">Manage sales invoices and track payments</p>
          </div>
          {canManage && (
            <button
              onClick={async () => {
                resetForm();
                const nextInvoiceNumber = await generateNextInvoiceNumber();
                setFormData(prev => ({ ...prev, invoice_number: nextInvoiceNumber }));
                setModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Create Invoice
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6">
            <p className="text-sm text-blue-600">Total Revenue</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">Rp {stats.totalRevenue.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-6">
            <p className="text-sm text-red-600">Pending Payment</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6">
            <p className="text-sm text-green-600">Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.paid}</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          actions={canManage ? (invoice) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleView(invoice)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="View Invoice"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleEdit(invoice)}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="Edit Invoice"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(invoice.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Delete Invoice"
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
          title={editingInvoice ? "Edit Sales Invoice" : "Create Sales Invoice"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="INV-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms *
                </label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="0">Immediate</option>
                  <option value="15">15 Days</option>
                  <option value="30">30 Days</option>
                  <option value="45">45 Days</option>
                  <option value="60">60 Days</option>
                  <option value="advance">Advance</option>
                  <option value="50-50">50% Adv & 50% on Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number
                </label>
                <input
                  type="text"
                  value={formData.po_number}
                  onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Customer PO Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Challan #
                </label>
                <input
                  type="text"
                  value={formData.delivery_challan_number}
                  onChange={(e) => setFormData({ ...formData, delivery_challan_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount (Rp)
                </label>
                <input
                  type="number"
                  value={formData.discount === 0 ? '' : formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Invoice Items</h3>
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
                  return (
                    <div key={index} className="grid grid-cols-6 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Product</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItemTotal(index, { ...item, product_id: e.target.value, batch_id: null })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.product_name}</option>
                          ))}
                        </select>
                      </div>

                      {item.product_id && availableBatches.length > 0 && (
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Batch</label>
                          <select
                            value={item.batch_id || ''}
                            onChange={(e) => updateItemTotal(index, { ...item, batch_id: e.target.value || null })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select</option>
                            {availableBatches.map((b) => (
                              <option key={b.id} value={b.id}>{b.batch_number}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Qty</label>
                        <input
                          type="number"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => updateItemTotal(index, { ...item, quantity: e.target.value === '' ? 1 : Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          required
                          min="1"
                          placeholder="1"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price</label>
                        <input
                          type="number"
                          value={item.unit_price === 0 ? '' : item.unit_price}
                          onChange={(e) => updateItemTotal(index, { ...item, unit_price: e.target.value === '' ? 0 : Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          required
                          min="0"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tax %</label>
                        <input
                          type="number"
                          value={item.tax_rate === 0 ? '' : item.tax_rate}
                          onChange={(e) => updateItemTotal(index, { ...item, tax_rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          min="0"
                          placeholder="11"
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">Total</label>
                          <input
                            type="text"
                            value={(item.total || 0).toFixed(2)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100"
                            disabled
                          />
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">Rp {calculateTotals().subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span className="font-medium">Rp {calculateTotals().taxAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="font-medium">-Rp {formData.discount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-blue-600">Rp {calculateTotals().total.toLocaleString('id-ID')}</span>
                  </div>
                </div>
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
                Create Invoice
              </button>
            </div>
          </form>
        </Modal>

        {viewModalOpen && selectedInvoice && (
          <InvoiceView
            invoice={selectedInvoice}
            items={invoiceItems}
            onClose={() => {
              setViewModalOpen(false);
              setSelectedInvoice(null);
              setInvoiceItems([]);
            }}
          />
        )}
      </div>
    </Layout>
  );
}
