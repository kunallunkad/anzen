import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Package, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';

interface StockSummary {
  product_id: string;
  product_name: string;
  product_code: string;
  unit: string;
  category: string;
  total_current_stock: number;
  active_batch_count: number;
  expired_batch_count: number;
  nearest_expiry_date: string | null;
}

interface DetailedBatch {
  id: string;
  batch_number: string;
  current_stock: number;
  expiry_date: string | null;
  import_date: string;
}

export function Stock() {
  const { t } = useLanguage();
  const { setCurrentPage } = useNavigation();
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StockSummary | null>(null);
  const [productBatches, setProductBatches] = useState<DetailedBatch[]>([]);

  useEffect(() => {
    loadStockSummary();
  }, []);

  const loadStockSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('product_stock_summary')
        .select('*')
        .gt('total_current_stock', 0)
        .order('product_name');

      if (error) throw error;
      setStockSummary(data || []);
    } catch (error) {
      console.error('Error loading stock summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductBatches = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, current_stock, expiry_date, import_date')
        .eq('product_id', productId)
        .eq('is_active', true)
        .gt('current_stock', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setProductBatches(data || []);
    } catch (error) {
      console.error('Error loading product batches:', error);
    }
  };

  const handleProductClick = async (product: StockSummary) => {
    setSelectedProduct(product);
    await loadProductBatches(product.product_id);
  };

  const goToBatches = () => {
    setCurrentPage('batches');
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isNearExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return new Date(expiryDate) <= thirtyDaysFromNow && !isExpired(expiryDate);
  };

  const getStockStatusColor = (stock: number, batchCount: number) => {
    if (stock === 0) return 'text-gray-400';
    if (stock < 500) return 'text-orange-600';
    return 'text-green-600';
  };

  const columns = [
    {
      key: 'product_code',
      label: 'Product Code',
      render: (item: StockSummary) => (
        <span className="font-mono text-sm">{item.product_code}</span>
      )
    },
    {
      key: 'product_name',
      label: 'Product Name',
      render: (item: StockSummary) => (
        <div>
          <div className="font-medium text-gray-900">{item.product_name}</div>
          <div className="text-xs text-gray-500 capitalize">{item.category}</div>
        </div>
      )
    },
    {
      key: 'stock',
      label: 'Available Stock',
      render: (item: StockSummary) => (
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${getStockStatusColor(item.total_current_stock, item.active_batch_count)}`}>
            {item.total_current_stock.toLocaleString()}
          </span>
          <span className="text-sm text-gray-600">{item.unit}</span>
        </div>
      )
    },
    {
      key: 'batches',
      label: 'Active Batches',
      render: (item: StockSummary) => (
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">
            {item.active_batch_count}
          </div>
          {item.expired_batch_count > 0 && (
            <div className="text-xs text-red-600">
              {item.expired_batch_count} expired
            </div>
          )}
        </div>
      )
    },
    {
      key: 'expiry',
      label: 'Nearest Expiry',
      render: (item: StockSummary) => (
        <div>
          {item.nearest_expiry_date ? (
            <div className={`text-sm ${
              isExpired(item.nearest_expiry_date) ? 'text-red-700 font-semibold' :
              isNearExpiry(item.nearest_expiry_date) ? 'text-orange-600 font-semibold' :
              'text-gray-700'
            }`}>
              {new Date(item.nearest_expiry_date).toLocaleDateString()}
              {isNearExpiry(item.nearest_expiry_date) && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">Expiring Soon</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">No expiry</span>
          )}
        </div>
      )
    },
  ];

  const batchColumns = [
    {
      key: 'batch_number',
      label: 'Batch Number',
      render: (batch: DetailedBatch) => (
        <span className="font-mono text-sm">{batch.batch_number}</span>
      )
    },
    {
      key: 'stock',
      label: 'Stock',
      render: (batch: DetailedBatch) => (
        <span className="font-semibold">{batch.current_stock.toLocaleString()} {selectedProduct?.unit}</span>
      )
    },
    {
      key: 'import_date',
      label: 'Import Date',
      render: (batch: DetailedBatch) => (
        <span className="text-sm text-gray-600">
          {new Date(batch.import_date).toLocaleDateString()}
        </span>
      )
    },
    {
      key: 'expiry_date',
      label: 'Expiry Date',
      render: (batch: DetailedBatch) => (
        <span className={`text-sm ${
          isExpired(batch.expiry_date) ? 'text-red-700 font-semibold' :
          isNearExpiry(batch.expiry_date) ? 'text-orange-600 font-semibold' :
          'text-gray-700'
        }`}>
          {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : 'N/A'}
        </span>
      )
    },
  ];

  const totalStock = stockSummary.reduce((sum, item) => sum + item.total_current_stock, 0);
  const totalProducts = stockSummary.length;
  const lowStockProducts = stockSummary.filter(item => item.total_current_stock < 500).length;
  const productsWithNearExpiry = stockSummary.filter(item =>
    item.nearest_expiry_date && isNearExpiry(item.nearest_expiry_date)
  ).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock Overview</h1>
            <p className="text-gray-600 mt-1">Real-time inventory across all batches</p>
          </div>
          <button
            onClick={goToBatches}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Package className="w-5 h-5" />
            View Batches
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Products In Stock</p>
                <p className="text-3xl font-bold mt-1">{totalProducts}</p>
              </div>
              <Package className="w-10 h-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Stock Units</p>
                <p className="text-3xl font-bold mt-1">{totalStock.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Low Stock Items</p>
                <p className="text-3xl font-bold mt-1">{lowStockProducts}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Near Expiry</p>
                <p className="text-3xl font-bold mt-1">{productsWithNearExpiry}</p>
              </div>
              <Calendar className="w-10 h-10 text-red-200" />
            </div>
          </div>
        </div>

        {selectedProduct && (
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedProduct.product_name}
                </h2>
                <p className="text-sm text-gray-500">{selectedProduct.product_code}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <DataTable
                columns={batchColumns}
                data={productBatches}
                loading={false}
              />
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Available Stock by Product</h2>
            <p className="text-sm text-gray-500 mt-1">Click on any product to view batch details</p>
          </div>

          <DataTable
            columns={columns}
            data={stockSummary}
            loading={loading}
            onRowClick={handleProductClick}
          />

          {!loading && stockSummary.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No stock available</p>
              <p className="text-gray-400 text-sm mt-2">All products are currently out of stock</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
