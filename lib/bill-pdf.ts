import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Image } from 'react-native';
import { type BillDetail } from './api';

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash', upi: 'UPI', card: 'Card',
    credit: 'Credit (Udhaar)', mix: 'Split Payment',
  };
  return map[method] || method;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    paid: 'Paid', partial: 'Partial', pending: 'Pending', cancelled: 'Cancelled',
  };
  return map[status] || status;
}

function amountInWords(n: number): string {
  if (n === 0) return 'Zero';
  const numToWords = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numToWords(num % 100) : '');
    if (num < 100000) return numToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numToWords(num % 1000) : '');
    return numToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numToWords(num % 100000) : '');
  };
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let result = numToWords(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result;
}

function invoiceHTML(bill: BillDetail, shopName: string, shopLogoBase64?: string, brandLogoBase64?: string, shopAddress?: string): string {
  const hasGstItems = bill.items.some(item => Number(item.gst_rate) > 0);

  const itemsRows = bill.items.map((item, i) => {
    const gstRate = Number(item.gst_rate);
    const hasGst = gstRate > 0;
    return `
    <tr${i % 2 === 1 ? ' class="alt"' : ''}>
      <td class="center">${i + 1}</td>
      <td>${item.product_name}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">${Number(item.unit_price).toFixed(2)}</td>
      ${hasGst ? `<td class="right">${gstRate}%</td>` : '<td class="right">—</td>'}
      <td class="right">${Number(item.subtotal).toFixed(2)}</td>
      <td class="right bold">${Number(item.total).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const gstRows = (bill.gst_breakup || [])
    .filter(g => Number(g.gst_rate) > 0)
    .map(g => `
    <tr${(bill.gst_breakup || []).indexOf(g) % 2 === 1 ? ' class="alt"' : ''}>
      <td class="right">${g.gst_rate}%</td>
      <td class="right">${Number(g.taxable_value).toFixed(2)}</td>
      <td class="right">${Number(g.cgst).toFixed(2)}</td>
      <td class="right">${Number(g.sgst).toFixed(2)}</td>
      <td class="right">${Number(g.total_tax).toFixed(2)}</td>
    </tr>`).join('');

  const isPaid = bill.payment_status === 'paid';
  const isPartial = bill.payment_status === 'partial';

  const paidClass = isPaid ? 'paid' : isPartial ? 'partial' : 'pending';
  const statusColors: Record<string, string> = { paid: '#065f46', partial: '#92400e', pending: '#991b1b' };
  const statusBg: Record<string, string> = { paid: '#d1fae5', partial: '#fef3c7', pending: '#fee2e2' };

  const billDate = new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const billTime = new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;background:#f0f2f5;padding:24px}
.page{max-width:750px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(15,46,42,0.1);position:relative}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.1;pointer-events:none;z-index:0;text-align:center}
.watermark img{max-width:260px;max-height:260px}
.watermark .watermark-tagline{font-size:15px;font-weight:700;color:#0f2e2a;letter-spacing:1.5px;margin-top:8px;opacity:0.9}
.watermark-text{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:96px;font-weight:900;color:#0f2e2a;opacity:0.045;pointer-events:none;z-index:0;white-space:nowrap;letter-spacing:10px;text-align:center}
.watermark-text .watermark-tagline{font-size:22px;font-weight:700;letter-spacing:3px;margin-top:8px;opacity:0.9}
.header{background:linear-gradient(135deg,#0f2e2a 0%,#1a6b5e 100%);padding:28px 36px;color:#fff;position:relative;z-index:1}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.header .sub{font-size:20px;font-weight:700;opacity:0.95;letter-spacing:0.2px}
.header .address{font-size:10px;opacity:0.55;font-weight:400;margin-top:3px;line-height:1.4;max-width:340px}
.header .date-row{display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1)}
.header .date-row span{font-size:11px;opacity:0.8;letter-spacing:0.2px}
.badge{display:inline-block;border-radius:20px;padding:5px 16px;font-size:10px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase}
.content{position:relative;z-index:1;padding:0}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #f0f0f0}
.info-block{padding:20px 28px}
.info-block:first-child{border-right:1px solid #f0f0f0}
.info-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:4px}
.info-value{font-size:13px;font-weight:600;color:#111827}
.info-sub{font-size:11px;color:#6b7280;margin-top:2px}
.section{padding:24px 28px}
.section-title{font-size:13px;font-weight:700;color:#0f2e2a;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #e5e7eb;letter-spacing:0.8px;text-transform:uppercase}
table{width:100%;border-collapse:separate;border-spacing:0}
table.items th{background:#f9fafb;color:#6b7280;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:10px 8px;text-align:right;border-bottom:2px solid #e5e7eb}
table.items th:first-child{text-align:center;border-radius:10px 0 0 0}
table.items th:nth-child(2){text-align:left}
table.items th:last-child{border-radius:0 10px 0 0}
table.items td{padding:10px 8px;text-align:right;border-bottom:1px solid #f3f4f6;color:#374151;font-size:12px}
table.items td:first-child{text-align:center;color:#9ca3af}
table.items td:nth-child(2){text-align:left;color:#111827;font-weight:600}
table.items td.bold{font-weight:700}
table.items tr:last-child td{border-bottom:none}
.totals-wrap{padding:4px 28px 12px;display:flex;justify-content:flex-end}
table.totals{min-width:260px;border-collapse:collapse;font-size:12px}
table.totals td{padding:4px 0;border:none}
table.totals .label{color:#6b7280;text-align:left;padding-right:24px}
table.totals .value{text-align:right;font-weight:600;color:#111827}
table.totals .sep td{padding-top:6px}
table.totals .sep-inner{border-top:1px solid #e5e7eb}
table.totals .grand-total td{padding-top:6px;font-size:15px;font-weight:800;color:#0f2e2a}
table.totals .grand-total .sep-inner{border-top:2px solid #0f2e2a}
table.totals .paid td{color:#065f46;font-weight:700}
table.totals .due td{color:#d97706;font-weight:700}
.amount-words{padding:0 28px 16px;font-size:11px;color:#6b7280;line-height:1.6}
.amount-words strong{color:#111827}
${gstRows ? `
.gst-section{padding:0 28px 16px}
.gst-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;margin-bottom:8px}
table.gst{width:100%;border-collapse:separate;border-spacing:0;font-size:11px}
table.gst th{background:#f9fafb;color:#6b7280;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:8px;text-align:right;border-bottom:2px solid #e5e7eb}
table.gst th:first-child{text-align:left;border-radius:8px 0 0 0}
table.gst th:last-child{border-radius:0 8px 0 0}
table.gst td{padding:6px 8px;text-align:right;border-bottom:1px solid #f3f4f6;color:#374151}
table.gst td:first-child{text-align:left}
table.gst tr:last-child td{border-bottom:none}
` : ''}
${bill.payments && bill.payments.length > 0 ? `
.payment-section{padding:0 28px 16px}
.pay-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;margin-bottom:8px}
table.payments{width:100%;border-collapse:separate;border-spacing:0;font-size:11px}
table.payments th{background:#f9fafb;color:#6b7280;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:8px;text-align:left;border-bottom:2px solid #e5e7eb}
table.payments th:last-child{text-align:right}
table.payments th:first-child{border-radius:8px 0 0 0}
table.payments th:last-child{border-radius:0 8px 0 0}
table.payments td{padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#374151}
table.payments td:last-child{text-align:right;font-weight:600}
table.payments tr:last-child td{border-bottom:none}
` : ''}
.footer{text-align:center;padding:24px 32px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ca3af;letter-spacing:0.5px;position:relative;z-index:1;background:#fafafa}
.footer .thanks{font-size:14px;font-weight:700;color:#0f2e2a;letter-spacing:0.3px;margin-bottom:2px}
.footer .sub{font-size:10px;opacity:0.8;margin-bottom:8px}
.footer .powered{font-size:9px;color:#d1d5db;letter-spacing:0.5px}
</style>
</head>
<body>
<div class="page">
  ${brandLogoBase64
    ? `<div class="watermark"><img src="${brandLogoBase64}" /><div class="watermark-tagline">Smart dukan · Smart hisaab</div></div>`
    : `<div class="watermark-text">KhataFlow<div class="watermark-tagline">Smart dukan · Smart hisaab</div></div>`
  }
  <div class="content">
  <div class="header">
    <div class="header-top">
      <div>
        <div class="sub">${shopName}</div>
        ${shopAddress ? `<div class="address">${shopAddress}</div>` : ''}
      </div>
      ${shopLogoBase64 ? `<img src="${shopLogoBase64}" style="height:44px;width:auto;border-radius:8px" />` : ''}
    </div>
    <div class="date-row">
      <span>Invoice #${bill.bill_number} · ${billDate}</span>
      <span class="badge" style="background:${statusBg[paidClass]};color:${statusColors[paidClass]}">${formatStatus(bill.payment_status)}</span>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <div class="info-label">Bill To</div>
      <div class="info-value">${bill.customer?.name || 'Walk-in Customer'}</div>
      ${bill.customer?.phone ? `<div class="info-sub">${bill.customer.phone}</div>` : ''}
      ${bill.customer?.address ? `<div class="info-sub">${bill.customer.address}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="info-label">Invoice Details</div>
      <div class="info-value">${bill.bill_number}</div>
      <div class="info-sub">${billDate} · ${billTime}</div>
      <div class="info-sub">${formatPaymentMethod(bill.payment_method)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:28px;">#</th>
          <th>Description</th>
          <th style="width:36px;" class="center">Qty</th>
          <th style="width:56px;">Rate</th>
          ${hasGstItems ? '<th style="width:40px;">GST</th>' : ''}
          <th style="width:60px;">Amount</th>
          <th style="width:64px;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
  </div>

  <div class="totals-wrap">
    <table class="totals">
      ${bill.notes ? `<tr><td class="label" style="font-style:italic;max-width:180px" colspan="2">Note: ${bill.notes}</td></tr>` : ''}
      <tr><td class="label">Subtotal</td><td class="value">₹${Number(bill.subtotal).toFixed(2)}</td></tr>
      ${Number(bill.discount) > 0 ? `<tr><td class="label">Discount${bill.discount_type === 'percentage' ? ` (${bill.discount_value}% OFF)` : ''}</td><td class="value" style="color:#065f46">-₹${Number(bill.discount).toFixed(2)}</td></tr>` : ''}
      ${Number(bill.tax) > 0 ? `<tr><td class="label">GST Total</td><td class="value">₹${Number(bill.tax).toFixed(2)}</td></tr>` : ''}
      <tr class="sep"><td colspan="2"><div class="sep-inner"></div></td></tr>
      <tr class="grand-total"><td class="label">Grand Total</td><td class="value">₹${Number(bill.total).toFixed(2)}</td></tr>
      ${Number(bill.paid_amount) > 0 ? `<tr class="paid"><td class="label">Paid</td><td class="value">₹${Number(bill.paid_amount).toFixed(2)}</td></tr>` : ''}
      ${Number(bill.due_amount) > 0 ? `<tr class="due"><td class="label">Due (Udhaar)</td><td class="value">₹${Number(bill.due_amount).toFixed(2)}</td></tr>` : ''}
    </table>
  </div>

  <div class="amount-words">
    <strong>Amount in Words:</strong> ${amountInWords(Number(bill.total))} Only
  </div>

  ${gstRows ? `
  <div class="gst-section">
    <div class="gst-title">GST Breakup</div>
    <table class="gst">
      <thead><tr><th>Rate</th><th>Taxable Value</th><th>CGST</th><th>SGST</th><th>Total Tax</th></tr></thead>
      <tbody>${gstRows}</tbody>
    </table>
  </div>` : ''}

  ${bill.payments && bill.payments.length > 0 ? `
  <div class="payment-section">
    <div class="pay-title">Payment History</div>
    <table class="payments">
      <thead><tr><th>Date</th><th>Method</th><th>Ref</th><th>Amount</th></tr></thead>
      <tbody>${bill.payments.map((p, i) => {
        const d = p.payment_date ? new Date(p.payment_date) : null;
        const dateStr = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        return `<tr><td>${dateStr}</td><td>${formatPaymentMethod(p.payment_method)}</td><td style="color:#9ca3af">${p.reference || '—'}</td><td style="color:#111827;font-weight:600">₹${Number(p.amount).toFixed(2)}</td></tr>`;
      }).join('')}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <div class="thanks">Thank You</div>
    <div class="sub">Visit Again</div>
    <div class="powered">Powered by KhataFlow</div>
  </div>
  </div>
</div>
</body>
</html>`;
}

export async function generateInvoicePdf(bill: BillDetail, shopName?: string, shopLogoBase64?: string, shopAddress?: string): Promise<string> {
  let brandLogo = '';
  try {
    const asset = Image.resolveAssetSource(require('@/assets/images/logo.png'));
    if (asset?.uri) {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      brandLogo = 'data:image/png;base64,' + b64;
    }
  } catch {}

  const html = invoiceHTML(bill, shopName || 'KhataFlow', shopLogoBase64 || '', brandLogo, shopAddress);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

async function shareViaIntent(uri: string, title: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
      packageName: 'com.whatsapp',
      type: 'application/pdf',
      data: uri,
      extra: {
        'android.intent.extra.STREAM': uri,
        'android.intent.extra.TEXT': title,
      },
      flags: 1,
    });
    return true;
  } catch {
    return false;
  }
}

export async function shareInvoicePdf(bill: BillDetail, shopName?: string, shopLogoBase64?: string, shopAddress?: string): Promise<void> {
  const uri = await generateInvoicePdf(bill, shopName, shopLogoBase64, shopAddress);
  const title = `Invoice ${bill.bill_number} from ${shopName || ''}`;
  if (await shareViaIntent(uri, title)) return;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
  });
}

export async function shareOnWhatsApp(bill: BillDetail, shopName?: string, shopLogoBase64?: string, shopAddress?: string): Promise<void> {
  const uri = await generateInvoicePdf(bill, shopName, shopLogoBase64, shopAddress);
  const title = `Invoice ${bill.bill_number} from ${shopName || ''}`;
  if (await shareViaIntent(uri, title)) return;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share invoice ${bill.bill_number} with ${bill.customer?.name || 'customer'}`,
  });
}
