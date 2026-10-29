import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { createBusinessInvitation } from '../../services/businessService';
import { BusinessRole } from '../../types';
import { ROLE_DEFINITIONS } from '../../lib/constants';
import { Copy, Check, Mail, ExternalLink, MessageSquare, Send, Sparkles } from 'lucide-react';
import { openMailClient, formatEmailContent, generateMailtoUrl } from '../../services/mailService';

export const InviteMemberModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { activeBusiness } = useBusiness();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [role, setRole] = useState<BusinessRole>('Purchasing');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [sentDirectEmail, setSentDirectEmail] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const roleOptions = [
    { value: 'Manager', label: t('members.roleManager', 'Operations Manager') },
    { value: 'Purchasing', label: t('members.rolePurchasing', 'Purchasing Specialist') },
    { value: 'Warehouse', label: t('members.roleWarehouse', 'Warehouse & Godown Staff') },
    { value: 'Accountant', label: t('members.roleAccountant', 'Financial Accountant') },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || !user) return;

    setLoading(true);
    try {
      const res = await createBusinessInvitation(
        activeBusiness.id,
        activeBusiness.name,
        role,
        user.uid,
        email.trim() || undefined
      );
      setGeneratedCode(res.inviteCode);
    } catch (err) {
      console.error('Failed to create invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLinkOnly = () => {
    if (!generatedCode) return;
    const inviteLink = `${window.location.origin}/join?code=${generatedCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyFullMessage = () => {
    if (!generatedCode) return;
    const inviteLink = `${window.location.origin}/join?code=${generatedCode}`;
    navigator.clipboard.writeText(
      `You have been invited to join ${activeBusiness?.name} on Lofty ERP as ${role}!\nInvitation Code: ${generatedCode}\nLink: ${inviteLink}`
    );
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleCopyEmailText = () => {
    if (!generatedCode) return;
    const content = formatEmailContent({
      action: 'INVITATION',
      to: email || 'team@example.com',
      businessName: activeBusiness?.name,
      role,
      inviteCode: generatedCode,
      joinUrl: `${window.location.origin}/join?code=${generatedCode}`,
    });
    navigator.clipboard.writeText(`Subject: ${content.subject}\n\n${content.body}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleLaunchMailClient = () => {
    if (!generatedCode) return;
    const targetEmail = email.trim() || '';
    const content = formatEmailContent({
      action: 'INVITATION',
      to: targetEmail,
      businessName: activeBusiness?.name,
      role,
      inviteCode: generatedCode,
      joinUrl: `${window.location.origin}/join?code=${generatedCode}`,
    });

    openMailClient(targetEmail, content.subject, content.body);
    setSentDirectEmail(true);
  };

  const handleShareWhatsApp = () => {
    if (!generatedCode) return;
    const inviteLink = `${window.location.origin}/join?code=${generatedCode}`;
    const text = encodeURIComponent(
      `*Invitation to join ${activeBusiness?.name} on Lofty ERP*\n\n` +
      `Role: *${role}*\n` +
      `Invite Code: *${generatedCode}*\n\n` +
      `Click link to activate: ${inviteLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleClose = () => {
    setGeneratedCode(null);
    setEmail('');
    setSentDirectEmail(false);
    onClose();
  };

  const emailContent = generatedCode
    ? formatEmailContent({
        action: 'INVITATION',
        to: email || '',
        businessName: activeBusiness?.name,
        role,
        inviteCode: generatedCode,
        joinUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${generatedCode}`,
      })
    : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('members.inviteMember', 'Invite Team Member')} maxWidth="md">
      {!generatedCode ? (
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-xs text-slate-500">
            Generate an authorization code to grant team members access to {activeBusiness?.name}.
          </p>

          <Select
            label="Designated Role"
            value={role}
            onChange={e => setRole(e.target.value as BusinessRole)}
            options={roleOptions}
            required
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
            <strong>Role Permissions:</strong> {ROLE_DEFINITIONS[role].description}
          </div>

          <Input
            label="Recipient Email (Optional)"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            helperText="If provided, an invitation email is automatically prepared with direct 1-click mail app launching."
          />

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={loading}>
              Generate Invitation Code
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 text-center py-1">
          {/* Authorization Code Banner */}
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-orange-800">
              Authorization Code for {role}
            </div>
            <div className="text-3xl font-extrabold text-brand-600 tracking-widest my-2 select-all font-mono">
              {generatedCode}
            </div>
            <p className="text-xs text-emerald-700 font-medium">Single-use secure credential &bull; Valid until accepted</p>
          </div>

          {/* Dedicated Mail Dispatcher Card */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50/70 via-slate-50 to-orange-50/40 border border-blue-200 rounded-lg text-left text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Email Invitation Ready</span>
              </div>
              {email ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  To: {email}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                  Ready to Dispatch
                </span>
              )}
            </div>

            <p className="text-slate-600 text-[11px] leading-snug">
              {email
                ? `An official invitation email has been pre-formatted for ${email}. Click below to launch your default email client (Gmail, Outlook, Mail.app) or copy the full email.`
                : 'Send this invitation directly via your email app (Gmail, Outlook) or copy the formatted message.'}
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleLaunchMailClient}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                {sentDirectEmail ? 'Open Email Again' : 'Send via Gmail / Mail App'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyEmailText}
                leftIcon={copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedEmail ? 'Email Copied!' : 'Copy Email Text'}
              </Button>
            </div>
          </div>

          {/* Direct link box */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-left text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Direct Invitation Link:</span>
            <div className="font-mono text-slate-700 text-[11px] truncate select-all bg-white p-1.5 border border-slate-200 rounded">
              {window.location.origin}/join?code={generatedCode}
            </div>
          </div>

          {/* Quick Sharing Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLinkOnly}
              leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedLink ? 'Link Copied!' : 'Copy Link Only'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShareWhatsApp}
              leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
            >
              Share via WhatsApp
            </Button>
            <Button variant="primary" size="sm" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
