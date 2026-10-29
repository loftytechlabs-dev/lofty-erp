/**
 * =========================================================================
 * LOFTY ERP — GOOGLE APPS SCRIPT MAIL DISPATCHER (Code.gs)
 * =========================================================================
 * 
 * This script runs completely free inside Google Apps Script (script.google.com).
 * It acts as a serverless webhook for Lofty ERP to send emails using your Gmail
 * or Google Workspace account without requiring Firebase Cloud Functions or paid
 * third-party mail providers (SendGrid, Mailgun, etc.).
 *
 * HOW TO DEPLOY:
 * 1. Go to https://script.google.com/ and click "New project".
 * 2. Delete all existing code in Code.gs and paste this entire file.
 * 3. Click "Deploy" (top right) -> "New deployment".
 * 4. Choose type: "Web app".
 * 5. Set description: "Lofty ERP Mail Service".
 * 6. Set "Execute as": "Me (your-email@gmail.com)".
 * 7. Set "Who has access": "Anyone" (crucial for receiving webhook calls from the app).
 * 8. Click "Deploy", authorize Google permissions when prompted.
 * 9. Copy the generated Web App URL (e.g., https://script.google.com/macros/s/.../exec).
 * 10. Paste it into your Lofty ERP .env file as:
 *     VITE_MAIL_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
 *
 * Supported Actions:
 * - INVITATION: Send team member invitation with code & joining link
 * - PURCHASE_ORDER: Send PO summary to vendor
 * - DELIVERY_ALERT: Notify warehouse/managers of a new truck check-in
 * - BILL_CORRECTION: Request supplier invoice correction with discrepancy details
 * - PAYMENT_RECEIPT: Send payment remittance advice to supplier
 */

function doPost(e) {
  try {
    var rawData = e.postData ? e.postData.contents : null;
    if (!rawData) {
      return responseJSON({ success: false, error: "Empty request body" });
    }

    var payload = JSON.parse(rawData);
    var action = payload.action;
    var to = payload.to;
    var subject = payload.subject;
    var businessName = payload.businessName || "Lofty ERP";

    if (!to || !action) {
      return responseJSON({ success: false, error: "Missing 'to' or 'action' parameter" });
    }

    var htmlBody = "";

    switch (action) {
      case "INVITATION":
        subject = subject || ("Invitation to join " + businessName + " on Lofty ERP");
        htmlBody = renderInvitationEmail(payload, businessName);
        break;

      case "PURCHASE_ORDER":
        subject = subject || ("Purchase Order " + (payload.orderNumber || "") + " from " + businessName);
        htmlBody = renderPurchaseOrderEmail(payload, businessName);
        break;

      case "DELIVERY_ALERT":
        subject = subject || ("Delivery Received for PO " + (payload.poNumber || "") + " — " + businessName);
        htmlBody = renderDeliveryAlertEmail(payload, businessName);
        break;

      case "BILL_CORRECTION":
        subject = subject || ("Invoice Correction Requested — " + (payload.invoiceNumber || "") + " — " + businessName);
        htmlBody = renderBillCorrectionEmail(payload, businessName);
        break;

      case "PAYMENT_RECEIPT":
        subject = subject || ("Payment Remittance Advice: " + (payload.amountFormatted || "") + " from " + businessName);
        htmlBody = renderPaymentEmail(payload, businessName);
        break;

      default:
        subject = subject || ("Notification from " + businessName);
        htmlBody = renderGenericEmail(payload, businessName);
        break;
    }

    // Send email using Google's MailApp
    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: htmlBody,
      name: businessName + " (via Lofty ERP)"
    });

    return responseJSON({
      success: true,
      message: "Email dispatched successfully to " + to,
      action: action
    });

  } catch (err) {
    return responseJSON({
      success: false,
      error: err.toString()
    });
  }
}

function doGet(e) {
  return responseJSON({
    status: "online",
    service: "Lofty ERP Mail Webhook",
    timestamp: new Date().toISOString()
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------------------
// HTML EMAIL TEMPLATES (Clean, modern, responsive with orange brand accent)
// -------------------------------------------------------------------------

function getHeader(businessName, subtitle) {
  return (
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">' +
    '  <div style="background-color: #ea580c; padding: 24px; text-align: left;">' +
    '    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">' + escapeHtml(businessName) + '</h1>' +
    '    <p style="margin: 4px 0 0 0; color: #ffedd5; font-size: 13px;">' + escapeHtml(subtitle || "Business Operations via Lofty ERP") + '</p>' +
    '  </div>' +
    '  <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">'
  );
}

function getFooter() {
  return (
    '  </div>' +
    '  <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; color: #64748b; font-size: 12px;">' +
    '    Sent via <strong>Lofty ERP</strong> — Simple, connected operations for small manufacturers.<br/>' +
    '    Please do not reply directly to this automated notification.' +
    '  </div>' +
    '</div>'
  );
}

function renderInvitationEmail(data, businessName) {
  var code = escapeHtml(data.inviteCode || "");
  var role = escapeHtml(data.role || "Team Member");
  var joinUrl = escapeHtml(data.joinUrl || "");

  var html = getHeader(businessName, "Team Invitation");
  html += '<h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">You have been invited to join ' + escapeHtml(businessName) + '</h2>';
  html += '<p>You have been authorized to join as <strong>' + role + '</strong> on Lofty ERP.</p>';
  html += '<div style="background-color: #fff7ed; border: 1px dashed #fdba74; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">';
  html += '  <div style="font-size: 12px; color: #9a3412; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Invitation Code</div>';
  html += '  <div style="font-size: 28px; font-weight: 800; color: #ea580c; letter-spacing: 4px; margin-top: 6px;">' + code + '</div>';
  html += '</div>';

  if (joinUrl) {
    html += '<div style="text-align: center; margin: 24px 0;">';
    html += '  <a href="' + joinUrl + '" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">Accept Invitation & Join Business</a>';
    html += '</div>';
  }

  html += '<p style="color: #64748b; font-size: 13px;">Open Lofty ERP, sign in with your Google account, select "I work for a business", and enter the 8-character invitation code above.</p>';
  html += getFooter();
  return html;
}

function renderPurchaseOrderEmail(data, businessName) {
  var html = getHeader(businessName, "Purchase Order");
  html += '<h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Purchase Order #' + escapeHtml(data.orderNumber || "") + '</h2>';
  html += '<p>Dear ' + escapeHtml(data.vendorName || "Supplier") + ',</p>';
  html += '<p>Please find our purchase order details below:</p>';

  html += '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">';
  html += '  <thead>';
  html += '    <tr style="background-color: #f1f5f9; text-align: left;">';
  html += '      <th style="padding: 8px; border: 1px solid #cbd5e1;">Item</th>';
  html += '      <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">Qty</th>';
  html += '      <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Unit Price</th>';
  html += '      <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Total</th>';
  html += '    </tr>';
  html += '  </thead>';
  html += '  <tbody>';

  var items = data.items || [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html += '<tr>';
    html += '  <td style="padding: 8px; border: 1px solid #e2e8f0;">' + escapeHtml(it.productName) + '<br/><span style="color:#64748b; font-size:11px;">SKU: ' + escapeHtml(it.sku) + '</span></td>';
    html += '  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">' + it.quantity + ' ' + escapeHtml(it.unit || "") + '</td>';
    html += '  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">' + escapeHtml(it.unitPriceFormatted || it.unitPrice) + '</td>';
    html += '  <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">' + escapeHtml(it.lineTotalFormatted || it.lineTotal) + '</td>';
    html += '</tr>';
  }

  html += '  </tbody>';
  html += '</table>';

  html += '<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 12px;">';
  html += '  <p style="margin: 4px 0;"><strong>Delivery Godown:</strong> ' + escapeHtml(data.warehouseName || "Main Godown") + '</p>';
  html += '  <p style="margin: 4px 0;"><strong>Expected Delivery Date:</strong> ' + escapeHtml(data.expectedDeliveryDate || "Immediate") + '</p>';
  html += '  <p style="margin: 4px 0; font-size: 15px; color: #ea580c;"><strong>Grand Total: ' + escapeHtml(data.grandTotalFormatted || data.grandTotal) + '</strong></p>';
  html += '</div>';

  if (data.notes) {
    html += '<p style="margin-top: 12px; font-size: 13px; color: #475569;"><strong>Special Instructions:</strong> ' + escapeHtml(data.notes) + '</p>';
  }

  html += getFooter();
  return html;
}

function renderDeliveryAlertEmail(data, businessName) {
  var html = getHeader(businessName, "Delivery Registration");
  html += '<h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Delivery Arrived: PO #' + escapeHtml(data.poNumber || "") + '</h2>';
  html += '<p>A physical delivery has checked in at <strong>' + escapeHtml(data.warehouseName || "Godown") + '</strong>.</p>';
  html += '<ul>';
  html += '  <li><strong>Vendor:</strong> ' + escapeHtml(data.vendorName || "") + '</li>';
  html += '  <li><strong>Challan / DC Number:</strong> ' + escapeHtml(data.challanNumber || "N/A") + '</li>';
  html += '  <li><strong>Vehicle / Driver:</strong> ' + escapeHtml(data.vehicleNumber || "") + ' (' + escapeHtml(data.driverName || "") + ')</li>';
  html += '</ul>';
  html += '<p>Please log in to Lofty ERP to perform physical count verification and bill inspection.</p>';
  html += getFooter();
  return html;
}

function renderBillCorrectionEmail(data, businessName) {
  var html = getHeader(businessName, "Invoice Correction Request");
  html += '<h2 style="font-size: 18px; margin-top: 0; color: #dc2626;">Invoice Correction Requested</h2>';
  html += '<p>Dear ' + escapeHtml(data.vendorName || "Supplier") + ',</p>';
  html += '<p>During verification of invoice <strong>#' + escapeHtml(data.invoiceNumber || "") + '</strong> against Purchase Order <strong>#' + escapeHtml(data.poNumber || "") + '</strong>, discrepancies were noted by our accounts department.</p>';
  html += '<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px; margin: 16px 0; color: #991b1b;">';
  html += '  <strong>Discrepancy Details / Reason:</strong>';
  html += '  <p style="margin: 6px 0 0 0;">' + escapeHtml(data.details || data.rejectionReason || "Quantity or price mismatch with physical gate receipt.") + '</p>';
  html += '</div>';
  html += '<p>Please review and provide a revised invoice or credit note.</p>';
  html += getFooter();
  return html;
}

function renderPaymentEmail(data, businessName) {
  var html = getHeader(businessName, "Payment Advice");
  html += '<h2 style="font-size: 18px; margin-top: 0; color: #15803d;">Payment Remittance Advice</h2>';
  html += '<p>Dear ' + escapeHtml(data.vendorName || "Supplier") + ',</p>';
  html += '<p>We have processed a payment with the following details:</p>';
  html += '<ul>';
  html += '  <li><strong>Amount Paid:</strong> ' + escapeHtml(data.amountFormatted || data.amount) + '</li>';
  html += '  <li><strong>Payment Date:</strong> ' + escapeHtml(data.paymentDate || "") + '</li>';
  html += '  <li><strong>Payment Method:</strong> ' + escapeHtml(data.paymentMethod || "Bank Transfer") + '</li>';
  html += '  <li><strong>Reference / UTR / Cheque #:</strong> ' + escapeHtml(data.referenceNumber || "N/A") + '</li>';
  html += '  <li><strong>Invoice Covered:</strong> #' + escapeHtml(data.invoiceNumber || "") + '</li>';
  html += '</ul>';
  html += getFooter();
  return html;
}

function renderGenericEmail(data, businessName) {
  var html = getHeader(businessName, "Business Notification");
  html += '<p>' + escapeHtml(data.message || "") + '</p>';
  html += getFooter();
  return html;
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
