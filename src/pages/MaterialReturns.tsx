import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, Plus, Search, CheckCircle, XCircle, Clock, Package, FileText, Upload, Eye } from 'lucide-react';
import { Modal } from '../components/Modal';

interface MaterialReturn {
  id: string;
  return_number: string;
  return_date: string;
  return_type: string;
  return_reason: string;
  status: string;
  financial_impact: number;
  credit_note_issued: boolean;
  credit_note_number?: string;
  restocked: boolean;
  customer: {
    company_name: string;
  };
  approval_workflow?: {
    status: string;
    approved_by?: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

interface ReturnItem {
  id?: string;
  product_id: string;
  batch_id?: string;
  quantity_returned: number;
  original_quantity?: number;
  unit_price: number;
  condition: string;
  disposition: string;
  notes?: string;
}

interface Customer {
  id: string;
  company_name: string;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
}

interface Batch {
  id: string;
  batch_number: string;
  current_stock: number;
}

interface DeliveryChallan {
  id: string;
  dc_number: string;
  dc_date: string;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
}

export default function MaterialReturns() {
  const { user, userProfile } = useAuth();
  const { t } = useLanguage();
  const [returns, setReturns] = useState<MaterialReturn[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<MaterialReturn[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<MaterialReturn | null>(null);
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [deliveryChallans, setDeliveryChallans] = useState<DeliveryChallan[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  const [formData, setFormData] = useState({
    customer_id: '',
    original_dc_id: '',
    original_invoice_id: '',
    return_date: new Date().toISOString().split('T')[0],
    return_type: 'quality_issue',
    return_reason: '',
    notes: '',
    restocked: false,
  });

  useEffect(() => {
    fetchReturns();
    fetchCustomers();
    fetchProducts();
  }, []);

  useEffect(() => {
    filterReturns();
  }, [searchTerm, statusFilter, returns]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('material_returns')
        .select(`
          *,
          customer:customers(company_name),
          approval_workflow:approval_workflows(status, approved_by),
          created_by_profile:user_profiles!material_returns_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (error: any) {
      console.error('Error fetching returns:', error);
      alert(t('errorFetchingReturns') || 'Error fetching returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, company_name')
      .eq('is_active', true)
      .order('company_name');
    setCustomers(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, product_name, product_code')
      .eq('is_active', true)
      .order('product_name');
    setProducts(data || []);
  };

  const fetchBatchesForProduct = async (productId: string) => {
    const { data } = await supabase
      .from('batches')
      .select('id, batch_number, current_stock')
      .eq('product_id', productId)
      .gt('current_stock', 0)
      .order('batch_number');
    setBatches(data || []);
  };

  const fetchDeliveryChallans = async (customerId: string) => {
    const { data } = await supabase
      .from('delivery_challans')
      .select('id, dc_number, dc_date')
      .eq('customer_id', customerId)
      .order('dc_date', { ascending: false });
    setDeliveryChallans(data || []);
  };

  const fetchSalesInvoices = async (customerId: string) => {
    const { data } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, invoice_date')
      .eq('customer_id', customerId)
      .order('invoice_date', { ascending: false });
    setSalesInvoices(data || []);
  };

  const filterReturns = () => {
    let filtered = returns;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.return_reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredReturns(filtered);
  };

  const handleCustomerChange = (customerId: string) => {
    setFormData({ ...formData, customer_id: customerId });
    if (customerId) {
      fetchDeliveryChallans(customerId);
      fetchSalesInvoices(customerId);
    }
  };

  const addReturnItem = () => {
    setReturnItems([
      ...returnItems,
      {
        product_id: '',
        batch_id: '',
        quantity_returned: 0,
        unit_price: 0,
        condition: 'good',
        disposition: 'pending',
      },
    ]);
  };

  const updateReturnItem = (index: number, field: string, value: any) => {
    const updated = [...returnItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'product_id') {
      fetchBatchesForProduct(value);
      updated[index].batch_id = '';
    }

    setReturnItems(updated);
  };

  const removeReturnItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id || !formData.return_reason || returnItems.length === 0) {
      alert(t('pleaseCompleteAllFields') || 'Please complete all required fields');
      return;
    }

    try {
      const { data: returnData, error: returnError } = await supabase
        .from('material_returns')
        .insert({
          ...formData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      const itemsWithReturnId = returnItems.map(item => ({
        ...item,
        return_id: returnData.id,
      }));

      const { error: itemsError } = await supabase
        .from('material_return_items')
        .insert(itemsWithReturnId);

      if (itemsError) throw itemsError;

      const financialImpact = returnItems.reduce(
        (sum, item) => sum + item.quantity_returned * item.unit_price,
        0
      );

      if (financialImpact >= 500) {
        await supabase.from('approval_workflows').insert({
          transaction_type: 'material_return',
          transaction_id: returnData.id,
          requested_by: user?.id,
          amount: financialImpact,
          status: 'pending',
        });
      }

      alert(t('returnCreatedSuccessfully') || 'Material return created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchReturns();
    } catch (error: any) {
      console.error('Error creating return:', error);
      alert(error.message || t('errorCreatingReturn') || 'Error creating material return');
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      original_dc_id: '',
      original_invoice_id: '',
      return_date: new Date().toISOString().split('T')[0],
      return_type: 'quality_issue',
      return_reason: '',
      notes: '',
      restocked: false,
    });
    setReturnItems([]);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
    };

    const icons = {
      pending_approval: <Clock className="w-3 h-3 mr-1" />,
      approved: <CheckCircle className="w-3 h-3 mr-1" />,
      rejected: <XCircle className="w-3 h-3 mr-1" />,
      completed: <CheckCircle className="w-3 h-3 mr-1" />,
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status as keyof typeof icons]}
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t('loading') || 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {t('materialReturns') || 'Material Returns'}
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('newReturn') || 'New Return'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t('searchReturns') || 'Search returns...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('allStatuses') || 'All Statuses'}</option>
            <option value="pending_approval">{t('pendingApproval') || 'Pending Approval'}</option>
            <option value="approved">{t('approved') || 'Approved'}</option>
            <option value="rejected">{t('rejected') || 'Rejected'}</option>
            <option value="completed">{t('completed') || 'Completed'}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('returnNumber') || 'Return #'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('date') || 'Date'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('customer') || 'Customer'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('type') || 'Type'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('amount') || 'Amount'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status') || 'Status'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions') || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReturns.map((returnItem) => (
                <tr key={returnItem.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {returnItem.return_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(returnItem.return_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {returnItem.customer.company_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {returnItem.return_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    ${returnItem.financial_impact?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getStatusBadge(returnItem.status)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => {
                        setSelectedReturn(returnItem);
                        setShowDetailsModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t('view') || 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReturns.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {t('noReturnsFound') || 'No returns found'}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          title={t('createMaterialReturn') || 'Create Material Return'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('customer') || 'Customer'} *
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('selectCustomer') || 'Select Customer'}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('returnDate') || 'Return Date'} *
                </label>
                <input
                  type="date"
                  value={formData.return_date}
                  onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('returnType') || 'Return Type'} *
                </label>
                <select
                  value={formData.return_type}
                  onChange={(e) => setFormData({ ...formData, return_type: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="quality_issue">{t('qualityIssue') || 'Quality Issue'}</option>
                  <option value="wrong_product">{t('wrongProduct') || 'Wrong Product'}</option>
                  <option value="excess_quantity">{t('excessQuantity') || 'Excess Quantity'}</option>
                  <option value="damaged">{t('damaged') || 'Damaged'}</option>
                  <option value="expired">{t('expired') || 'Expired'}</option>
                  <option value="other">{t('other') || 'Other'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('originalDeliveryChallan') || 'Original DC'} (Optional)
                </label>
                <select
                  value={formData.original_dc_id}
                  onChange={(e) => setFormData({ ...formData, original_dc_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('selectDC') || 'Select DC'}</option>
                  {deliveryChallans.map((dc) => (
                    <option key={dc.id} value={dc.id}>
                      {dc.dc_number} - {new Date(dc.dc_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('returnReason') || 'Return Reason'} *
              </label>
              <textarea
                value={formData.return_reason}
                onChange={(e) => setFormData({ ...formData, return_reason: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t('returnItems') || 'Return Items'} *
                </label>
                <button
                  type="button"
                  onClick={addReturnItem}
                  className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('addItem') || 'Add Item'}
                </button>
              </div>

              <div className="space-y-3">
                {returnItems.map((item, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateReturnItem(index, 'product_id', e.target.value)}
                        required
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">{t('selectProduct') || 'Select Product'}</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.product_name} ({product.product_code})
                          </option>
                        ))}
                      </select>

                      <select
                        value={item.batch_id}
                        onChange={(e) => updateReturnItem(index, 'batch_id', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">{t('selectBatch') || 'Select Batch'}</option>
                        {batches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batch_number} (Stock: {batch.current_stock})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('quantity') || 'Quantity'}
                        value={item.quantity_returned || ''}
                        onChange={(e) => updateReturnItem(index, 'quantity_returned', parseFloat(e.target.value))}
                        required
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />

                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('unitPrice') || 'Unit Price'}
                        value={item.unit_price || ''}
                        onChange={(e) => updateReturnItem(index, 'unit_price', parseFloat(e.target.value))}
                        required
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />

                      <select
                        value={item.condition}
                        onChange={(e) => updateReturnItem(index, 'condition', e.target.value)}
                        required
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="good">{t('good') || 'Good'}</option>
                        <option value="damaged">{t('damaged') || 'Damaged'}</option>
                        <option value="expired">{t('expired') || 'Expired'}</option>
                        <option value="unusable">{t('unusable') || 'Unusable'}</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => removeReturnItem(index)}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-lg"
                      >
                        {t('remove') || 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="restocked"
                checked={formData.restocked}
                onChange={(e) => setFormData({ ...formData, restocked: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="restocked" className="text-sm text-gray-700">
                {t('restockItems') || 'Restock items after approval'}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('createReturn') || 'Create Return'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
