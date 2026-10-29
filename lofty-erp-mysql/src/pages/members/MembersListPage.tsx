import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localStore } from '../../services/store';
import { BusinessMember, BusinessInvitation } from '../../types';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { InviteMemberModal } from '../../components/business/InviteMemberModal';
import { ROLE_DEFINITIONS } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import { UserCheck, Plus, Shield, Mail, Key, Lock } from 'lucide-react';

export const MembersListPage: React.FC = () => {
  const { activeBusiness, permissions } = useBusiness();
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();

  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [invitations, setInvitations] = useState<BusinessInvitation[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const loadData = () => {
    if (!activeBusiness) return;
    setMembers(localStore.getMembers(activeBusiness.id));
    setInvitations(localStore.getInvitations(activeBusiness.id));
  };

  useEffect(() => {
    loadData();
    const unsub = localStore.subscribe(loadData);
    return () => unsub();
  }, [activeBusiness]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('members.title', 'Team & Access Control')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('members.subtitle', 'Operational team members, role assignments, and member invites.')}
          </p>
        </div>

        {permissions.canManageMembers && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setInviteModalOpen(true)}
          >
            {t('members.invite', 'Invite Member')}
          </Button>
        )}
      </div>

      {/* Role Immutability Policy Banner */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between text-slate-600">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Role Immutability Policy:</strong> In compliance with statutory audit standards, operational roles are permanently locked upon invitation acceptance and cannot be altered to guarantee a tamper-evident audit trail.
          </span>
        </div>
      </div>

      {/* Role Definitions Reference Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(ROLE_DEFINITIONS) as (keyof typeof ROLE_DEFINITIONS)[]).map(r => (
          <div key={r} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">{r}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_DEFINITIONS[r].color}`}>
                Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{ROLE_DEFINITIONS[r].description}</p>
          </div>
        ))}
      </div>

      {/* Active Members Table */}
      <Card title="Active Business Members" subtitle="Authorized staff with permanently locked access credentials." noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">User Name</th>
                <th className="py-2.5 px-4 font-semibold">Email Address</th>
                <th className="py-2.5 px-4 font-semibold text-center">Assigned Role (Permanent)</th>
                <th className="py-2.5 px-4 font-semibold">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(m => (
                <tr key={m.uid} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">{m.displayName || 'Member'}</td>
                  <td className="py-3 px-4 text-slate-600">{m.email}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_DEFINITIONS[m.role].color}`}>
                      <Lock className="w-2.5 h-2.5 opacity-60 mr-1" />
                      <span>{m.role}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{formatDate(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pending Invitations Table */}
      <Card title="Pending Invitation Codes" subtitle="Active authorization codes awaiting redemption." noPadding>
        {invitations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No active invitation codes issued. Click "Invite Team Member" above to invite colleagues.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Invitation Code</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Designated Role</th>
                  <th className="py-2.5 px-4 font-semibold">Designated Recipient</th>
                  <th className="py-2.5 px-4 font-semibold">Expires</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map(inv => (
                  <tr key={inv.code} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700 tracking-wider">
                      {inv.code}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${ROLE_DEFINITIONS[inv.role].color}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{inv.recipientEmail || 'Anyone with code'}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(inv.expiresAt)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={inv.status === 'PENDING' ? 'warning' : 'success'} size="sm">
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InviteMemberModal isOpen={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
    </div>
  );
};
