/**
 * Comprehensive Mail & Notification Service for Lofty ERP
 * Supports:
 * 1. Direct Mail Client Launching (mailto:) with pre-formatted Subject & Body
 * 2. Express Backend Outbox Dispatcher (/api/send-mail)
 * 3. Google Apps Script Webhook (when configured in .env)
 * 4. Local Outbox Audit Trail for viewing sent notifications
 */

export interface EmailPayload {
  action: 'INVITATION' | 'PURCHASE_ORDER' | 'DELIVERY_ALERT' | 'BILL_CORRECTION' | 'PAYMENT_RECEIPT' | 'GENERAL';
  to: string;
  subject?: string;
  body?: string;
  businessName?: string;
  role?: string;
  inviteCode?: string;
  joinUrl?: string;
  poNumber?: string;
  amount?: number;
  deliveryNumber?: string;
  [key: string]: any;
}

export interface MailRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  action: string;
  businessName?: string;
  sentAt: string;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  deliveryMethod: 'DIRECT_CLIENT' | 'BACKEND_API' | 'WEBHOOK';
}

const OUTBOX_STORAGE_KEY = 'lofty_mail_outbox';

export function formatEmailContent(payload: EmailPayload): { subject: string; body: string } {
  const bName = payload.businessName || 'Lofty ERP Business';

  switch (payload.action) {
    case 'INVITATION': {
      const subject = payload.subject || `Invitation to join ${bName} on Lofty ERP (${payload.role || 'Member'})`;
      const body =
        payload.body ||
        `Hello,\n\n` +
        `You have been invited to join ${bName} on Lofty ERP as a ${payload.role || 'Team Member'}.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `INVITATION DETAILS:\n` +
        `• Business: ${bName}\n` +
        `• Assigned Role: ${payload.role || 'Member'}\n` +
        `• Authorization Code: ${payload.inviteCode || 'N/A'}\n` +
        `• 1-Click Join Link: ${payload.joinUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${payload.inviteCode || ''}`}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `To accept this invitation, open the link above or visit ${typeof window !== 'undefined' ? window.location.origin : ''}/join and enter your authorization code.\n\n` +
        `If you did not expect this invitation, please contact your company administrator.\n\n` +
        `Best regards,\n` +
        `${bName} Operations Team\n` +
        `Powered by Lofty ERP`;
      return { subject, body };
    }

    case 'PURCHASE_ORDER': {
      const subject = payload.subject || `Purchase Order ${payload.poNumber || ''} from ${bName}`;
      const body =
        payload.body ||
        `Dear Supplier,\n\n` +
        `Please find attached Purchase Order ${payload.poNumber || ''} issued by ${bName}.\n` +
        `Expected Delivery: ${payload.expectedDeliveryDate || 'As agreed'}\n\n` +
        `Best regards,\n` +
        `${bName} Purchasing Team`;
      return { subject, body };
    }

    case 'DELIVERY_ALERT': {
      const subject = payload.subject || `Gate Delivery Alert: ${payload.deliveryNumber || ''} at ${bName}`;
      const body =
        payload.body ||
        `Notice: Delivery arrival ${payload.deliveryNumber || ''} has been registered at the warehouse receiving dock.\n` +
        `PO Ref: ${payload.poNumber || 'N/A'}`;
      return { subject, body };
    }

    case 'PAYMENT_RECEIPT': {
      const subject = payload.subject || `Payment Confirmation from ${bName}`;
      const body =
        payload.body ||
        `Payment of ${payload.amount ? '₹' + payload.amount.toLocaleString('en-IN') : 'funds'} has been processed by ${bName}.`;
      return { subject, body };
    }

    default:
      return {
        subject: payload.subject || `Notification from ${bName}`,
        body: payload.body || `You have a new operational notification from ${bName}.`,
      };
  }
}

export function generateMailtoUrl(to: string, subject: string, body: string): string {
  const encTo = encodeURIComponent(to.trim());
  const encSub = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);
  return `mailto:${encTo}?subject=${encSub}&body=${encBody}`;
}

export function openMailClient(to: string, subject: string, body: string): boolean {
  if (typeof window === 'undefined') return false;
  const url = generateMailtoUrl(to, subject, body);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

export function getMailOutbox(): MailRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function saveMailRecord(record: MailRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const outbox = getMailOutbox();
    outbox.unshift(record);
    if (outbox.length > 100) outbox.pop();
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(outbox));
  } catch (err) {
    console.warn('Failed saving to mail outbox:', err);
  }
}

/**
 * Dispatches email across available channels and records in outbox
 */
export async function sendEmailNotification(
  payload: EmailPayload
): Promise<{ success: boolean; message: string; mailtoUrl: string; subject: string; body: string }> {
  const { subject, body } = formatEmailContent(payload);
  const mailtoUrl = generateMailtoUrl(payload.to, subject, body);

  const mailRecord: MailRecord = {
    id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    to: payload.to.trim().toLowerCase(),
    subject,
    body,
    action: payload.action,
    businessName: payload.businessName,
    sentAt: new Date().toISOString(),
    status: 'SENT',
    deliveryMethod: 'BACKEND_API',
  };

  // 1. Dispatch to Express Backend (/api/send-mail)
  let backendSuccess = false;
  try {
    const apiUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5001/api/send-mail'
      : '/api/send-mail';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        subject,
        body,
      }),
    });

    if (res.ok) {
      backendSuccess = true;
      mailRecord.deliveryMethod = 'BACKEND_API';
    }
  } catch (err) {
    // Backend offline or running in mock mode
  }

  // 2. Dispatch to Google Apps Script Webhook if configured
  const webhookUrl = import.meta.env?.VITE_MAIL_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, subject, body }),
        mode: 'no-cors',
      });
      mailRecord.deliveryMethod = 'WEBHOOK';
    } catch (e) {
      console.warn('Webhook dispatch error:', e);
    }
  }

  // 3. Persist in local client Outbox
  saveMailRecord(mailRecord);

  return {
    success: true,
    message: backendSuccess
      ? `Email queued and dispatched to ${payload.to}`
      : `Email ready for ${payload.to}. Click 'Send via Mail Client' to launch your mail application.`,
    mailtoUrl,
    subject,
    body,
  };
}
