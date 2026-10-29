import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import { createWarehouse } from '../../services/productService';
import { Warehouse } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { Warehouse as WarehouseIcon, Plus, MapPin } from 'lucide-react';

export const WarehousesListPage: React.FC = () => {
  const { activeBusiness, permissions } = useBusiness();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    if (!activeBusiness) return;
    setWarehouses(localStore.getWarehouses(activeBusiness.id));
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(loadData);
    return () => unsub();
  }, [activeBusiness]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !name.trim() || !code.trim()) return;

    setLoading(true);
    try {
      await createWarehouse(activeBusiness.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        location: location.trim(),
        isActive: true,
      });

      setIsModalOpen(false);
      setName('');
      setCode('');
      setLocation('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Godowns & Warehouses</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical receiving locations, storage sheds, and assembly depots.
          </p>
        </div>

        {permissions.canManageWarehouses && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Godown
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(w => {
          // Count products stocked in this warehouse
          const stockCount = localStore
            .getStockBalances(activeBusiness?.id || '')
            .filter(b => b.warehouseId === w.id && b.quantity > 0)
            .length;

          return (
            <div
              key={w.id}
              className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-brand-600 flex items-center justify-center mb-3">
                    <WarehouseIcon className="w-5 h-5" />
                  </div>
                  <Badge variant={w.isActive ? 'success' : 'neutral'} size="sm">
                    {w.code}
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{w.name}</h3>
                <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{w.location || 'Central Location'}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                Stocking <strong className="text-slate-800">{stockCount} product lines</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Godown / Storage Warehouse"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Godown / Warehouse Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Godown 2 — Nashik Assembly Depot"
            required
          />
          <Input
            label="Warehouse Code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. WH-NSK-02"
            required
          />
          <Input
            label="Physical Address / Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Sector 4, Ambad MIDC, Nashik"
            required
          />

          <div className="flex justify-end space-x-2 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={loading}>
              Create Godown
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
