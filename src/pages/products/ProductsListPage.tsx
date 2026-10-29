import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import { createProduct, updateProduct, getProducts } from '../../services/productService';
import { Product } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { STANDARD_UNITS, GST_RATES } from '../../lib/constants';
import { Package, Plus, Search, AlertCircle, Edit2 } from 'lucide-react';

export const ProductsListPage: React.FC = () => {
  const { activeBusiness, permissions } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState(STANDARD_UNITS[0]);
  const [category, setCategory] = useState('Timber & Lumber');
  const [reorderThreshold, setReorderThreshold] = useState<number>(20);
  const [taxRate, setTaxRate] = useState<number>(18);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!activeBusiness) return;
    const list = await getProducts(activeBusiness.id);
    setProducts(list);
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [activeBusiness]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setSku('');
    setUnit(STANDARD_UNITS[0]);
    setCategory('Timber & Lumber');
    setReorderThreshold(20);
    setTaxRate(18);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setUnit(p.unit);
    setCategory(p.category);
    setReorderThreshold(p.reorderThreshold);
    setTaxRate(p.taxRate);
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !name.trim() || !sku.trim()) return;

    setLoading(true);
    try {
      if (editingProduct) {
        await updateProduct(activeBusiness.id, {
          ...editingProduct,
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          unit,
          category: category.trim(),
          reorderThreshold: Number(reorderThreshold),
          taxRate: Number(taxRate),
        });
      } else {
        await createProduct(activeBusiness.id, {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          unit,
          category: category.trim(),
          reorderThreshold: Number(reorderThreshold),
          taxRate: Number(taxRate),
          isActive: true,
        });
      }
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Central Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Raw materials, components, SKUs, and default tax classifications.
          </p>
        </div>

        {permissions.canManageProducts && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Add New Product
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search products by name, SKU, or category..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          leftAddon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Product Name & Category</th>
                <th className="py-2.5 px-4 font-semibold">SKU Code</th>
                <th className="py-2.5 px-4 font-semibold">Unit of Measure</th>
                <th className="py-2.5 px-4 font-semibold text-center">GST Tax Rate</th>
                <th className="py-2.5 px-4 font-semibold text-center">Reorder Limit</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {p.name}
                    <div className="text-[10px] text-slate-400 font-normal">{p.category}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700">{p.sku}</td>
                  <td className="py-3 px-4 text-slate-600">{p.unit}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="neutral" size="sm">{p.taxRate}% GST</Badge>
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-slate-700">
                    {p.reorderThreshold} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={p.isActive ? 'success' : 'neutral'} size="sm">
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {permissions.canManageProducts && (
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="text-slate-400 hover:text-brand-600 p-1 rounded transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
          No products found matching "{searchQuery}".
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product to Central Catalog'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Product / Material Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Teak Wooden Planks (6ft x 4in x 1in)"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU Code"
              value={sku}
              onChange={e => setSku(e.target.value.toUpperCase())}
              placeholder="WD-TEAK-001"
              required
            />
            <Select
              label="Unit of Measure"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              options={STANDARD_UNITS.map(u => ({ value: u, label: u }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Timber & Lumber"
              required
            />
            <Select
              label="Applicable GST Bracket"
              value={taxRate}
              onChange={e => setTaxRate(Number(e.target.value))}
              options={GST_RATES}
            />
          </div>

          <Input
            label="Low-Stock Reorder Threshold"
            type="number"
            min="0"
            value={reorderThreshold}
            onChange={e => setReorderThreshold(parseInt(e.target.value) || 0)}
            helperText="An alert will trigger on the dashboard when warehouse stock drops below this number."
          />

          <div className="flex justify-end space-x-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={loading}>
              {editingProduct ? 'Update Product' : 'Save Product'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
