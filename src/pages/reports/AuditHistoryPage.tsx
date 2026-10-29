import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../contexts/BusinessContext';
import { localStore } from '../../services/store';
import { AuditLog } from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { formatDateTime } from '../../lib/utils';
import { History, Shield, Search } from 'lucide-react';
import { Input } from '../../components/common/Input';

export const AuditHistoryPage: React.FC = () => {
  const { activeBusiness } = useBusiness();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    if (!activeBusiness) return;
    setLogs(localStore.getAuditLogs(activeBusiness.id));
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(loadData);
    return () => unsub();
  }, [activeBusiness]);

  const filtered = logs.filter(l =>
    l.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(l.details).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Audit Trail & Activity Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, traceable history of purchase approvals, physical receipts, bill checks, and inventory movements.
          </p>
        </div>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Filter audit entries..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          leftAddon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </div>

      <Card noPadding>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No audit records matching query.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {filtered.map(log => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2 hover:bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant="neutral" size="sm">
                      {log.entityType.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-slate-400 font-mono text-[11px]">ID: {log.entityId}</span>
                  </div>
                  <div className="text-slate-700 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                </div>

                <div className="text-slate-400 text-[11px] whitespace-nowrap shrink-0">
                  {formatDateTime(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
