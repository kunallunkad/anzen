import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, Package } from 'lucide-react';

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  hsn_code: string;
  category: string;
  unit: string;
  packaging_type: string;
  default_supplier: string;
  description: string;
  total_quantity: number | null;
  per_pack_weight: number | null;
  pack_type: string | null;
  calculated_packs: number | null;
  is_active: boolean;
  created_at: string;
}

export function Products() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    hsn_code: '',
    category: 'api',
    unit: 'kg',
    packaging_type: '',
    default_supplier: '',
    description: '',
    total_quantity: '',
    per_pack_weight: '',
    pack_type: 'Bag',
  });
  const [calculatedPacks, setCalculatedPacks] = useState<number>(0);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const qty = parseFloat(formData.total_quantity) || 0;
    const packWeight = parseFloat(formData.per_pack_weight) || 0;
    if (qty > 0 && packWeight > 0) {
      setCalculatedPacks(Math.ceil(qty / packWeight));
    } else {
      setCalculatedPacks(0);
    }
  }, [formData.total_quantity, formData.per_pack_weight]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const qty = parseFloat(formData.total_quantity) || null;
      const packWeight = parseFloat(formData.per_pack_weight) || null;
      const packs = qty && packWeight ? Math.ceil(qty / packWeight) : null;

      const dataToSave = {
        product_name: formData.product_name,
        product_code: formData.product_code,
        hsn_code: formData.hsn_code,
        category: formData.category,
        unit: formData.unit,
        packaging_type: formData.packaging_type,
        default_supplier: formData.default_supplier,
        description: formData.description,
        total_quantity: qty,
        per_pack_weight: packWeight,
        pack_type: formData.pack_type || null,
        calculated_packs: packs,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(dataToSave)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...dataToSave, created_by: profile?.id }]);

        if (error) throw error;
      }

      setModalOpen(false);
      resetForm();
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      product_name: product.product_name,
      product_code: product.product_code,
      hsn_code: product.hsn_code,
      category: product.category,
      unit: product.unit,
      packaging_type: product.packaging_type,
      default_supplier: product.default_supplier,
      description: product.description,
      total_quantity: product.total_quantity?.toString() || '',
      per_pack_weight: product.per_pack_weight?.toString() || '',
      pack_type: product.pack_type || 'Bag',
    });
    setModalOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', product.id);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      product_name: '',
      product_code: '',
      hsn_code: '',
      category: 'api',
      unit: 'kg',
      packaging_type: '',
      default_supplier: '',
      description: '',
      total_quantity: '',
      per_pack_weight: '',
      pack_type: 'Bag',
    });
    setCalculatedPacks(0);
  };

  const columns = [
    { key: 'product_code', label: 'Product Code' },
    { key: 'product_name', label: 'Product Name' },
    { key: 'hsn_code', label: 'HSN Code' },
    {
      key: 'category',
      label: 'Category',
      render: (product: Product) => (
        <span className="capitalize">{product.category}</span>
      ),
    },
    {
      key: 'stock_info',
      label: 'Stock & Packaging',
      render: (product: Product) => {
        if (product.total_quantity && product.calculated_packs) {
          return (
            <div className="text-sm">
              <div className="font-medium">
                {product.total_quantity} {product.unit}
              </div>
              <div className="text-gray-500">
                ≈ {product.calculated_packs} {product.pack_type}s
              </div>
            </div>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-1">Manage your product catalog with packaging details</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>

        <DataTable
          data={products}
          columns={columns}
          loading={loading}
          actions={(product) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(product)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(product)}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.product_name}
                onChange={(e) =>
                  setFormData({ ...formData, product_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Code *
              </label>
              <input
                type="text"
                required
                value={formData.product_code}
                onChange={(e) =>
                  setFormData({ ...formData, product_code: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HSN Code
              </label>
              <input
                type="text"
                value={formData.hsn_code}
                onChange={(e) =>
                  setFormData({ ...formData, hsn_code: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="api">API</option>
                <option value="excipient">Excipient</option>
                <option value="solvent">Solvent</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit *
              </label>
              <select
                required
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="kg">Kilogram</option>
                <option value="litre">Litre</option>
                <option value="ton">Ton</option>
                <option value="piece">Piece</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Packaging Calculation
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Quantity
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.total_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, total_quantity: e.target.value })
                  }
                  placeholder="e.g., 1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">In {formData.unit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Per Pack Weight
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.per_pack_weight}
                  onChange={(e) =>
                    setFormData({ ...formData, per_pack_weight: e.target.value })
                  }
                  placeholder="e.g., 60"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.unit} per pack</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pack Type
                </label>
                <select
                  value={formData.pack_type}
                  onChange={(e) =>
                    setFormData({ ...formData, pack_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="Bag">Bag</option>
                  <option value="Drum">Drum</option>
                  <option value="Tin">Tin</option>
                  <option value="Carton">Carton</option>
                  <option value="Box">Box</option>
                  <option value="Container">Container</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {calculatedPacks > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Calculated Packs:</span> ≈ {calculatedPacks} {formData.pack_type}
                  {calculatedPacks !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {formData.total_quantity} {formData.unit} ÷ {formData.per_pack_weight} {formData.unit}/pack = {calculatedPacks} packs
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Supplier
            </label>
            <input
              type="text"
              value={formData.default_supplier}
              onChange={(e) =>
                setFormData({ ...formData, default_supplier: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
