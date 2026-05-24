import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
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

function invoiceHTML(bill: BillDetail, shopName: string): string {
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

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  @page { margin: 0; padding: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'DejaVu Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #e8e8e8;
    padding: 24px;
    color: #1a1a1a;
    font-size: 10px;
    line-height: 1.4;
  }

  .invoice {
    max-width: 680px;
    margin: 0 auto;
    background: #ffffff;
    padding: 0;
  }

  .top-strip {
    height: 6px;
    background: #1a5c4a;
  }

  .header {
    padding: 28px 32px 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1a5c4a;
  }

  .header-left {}

  .shop-name {
    font-size: 20px;
    font-weight: 800;
    color: #1a5c4a;
    letter-spacing: -0.3px;
    text-transform: uppercase;
  }

  .shop-tagline {
    font-size: 10px;
    color: #666;
    margin-top: 2px;
  }

  .header-right { text-align: right; }

  .invoice-title {
    font-size: 26px;
    font-weight: 800;
    color: #1a5c4a;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .invoice-sub {
    font-size: 10px;
    color: #888;
    margin-top: 2px;
  }

  .status-badge {
    display: inline-block;
    padding: 3px 14px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-radius: 3px;
    margin-top: 6px;
    ${isPaid ? 'background: #d1fae5; color: #065f46;' : isPartial ? 'background: #fef3c7; color: #92400e;' : 'background: #fee2e2; color: #991b1b;'}
  }

  .info-section {
    display: flex;
    padding: 16px 32px;
    border-bottom: 1px solid #e0e0e0;
  }

  .info-left { flex: 1; }
  .info-right { flex: 1; text-align: right; }

  .info-label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    margin-bottom: 2px;
  }

  .info-value {
    font-size: 11px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .info-value-light {
    font-size: 10px;
    color: #555;
    margin-top: 1px;
  }

  .bill-to {
    padding: 16px 32px;
    border-bottom: 1px solid #e0e0e0;
  }

  .bill-to-label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    margin-bottom: 4px;
  }

  .bill-to-name {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .bill-to-detail {
    font-size: 10px;
    color: #555;
    margin-top: 1px;
  }

  .items-section {
    padding: 4px 32px 0;
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }

  table.items th {
    background: #1a5c4a;
    color: #ffffff;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 7px 6px;
    text-align: right;
  }

  table.items th:first-child { text-align: center; }
  table.items th:nth-child(2) { text-align: left; }
  table.items th.center { text-align: center; }
  table.items th.right { text-align: right; }

  table.items td {
    padding: 6px 6px;
    text-align: right;
    border-bottom: 1px solid #f0f0f0;
    color: #1a1a1a;
  }

  table.items td:first-child { text-align: center; }
  table.items td:nth-child(2) { text-align: left; }
  table.items td.center { text-align: center; }
  table.items td.right { text-align: right; }
  table.items td.bold { font-weight: 700; }

  table.items tr.alt td { background: #f8faf9; }

  .totals-section {
    padding: 8px 32px 0;
  }

  table.totals {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-left: auto;
    width: auto;
    min-width: 280px;
    float: right;
  }

  table.totals td {
    padding: 3px 6px;
    border: none;
  }

  table.totals .label { color: #666; text-align: left; }
  table.totals .value { text-align: right; font-weight: 600; }
  table.totals .sep td { padding-top: 6px; }
  table.totals .sep-inner { border-top: 1px solid #e0e0e0; }

  table.totals .grand-total td {
    padding-top: 6px;
    font-size: 14px;
    font-weight: 800;
    color: #1a5c4a;
  }

  table.totals .grand-total .sep-inner { border-top: 2px solid #1a5c4a; }

  table.totals .paid td { color: #065f46; font-weight: 700; }
  table.totals .due td { color: #92400e; font-weight: 700; }

  .clearfix::after { content: ""; display: table; clear: both; }

  ${gstRows ? `
  .gst-section {
    padding: 12px 32px 0;
  }

  .gst-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    margin-bottom: 6px;
  }

  table.gst {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  table.gst th {
    background: #f0f0f0;
    color: #555;
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 5px 6px;
    text-align: right;
  }

  table.gst td {
    padding: 4px 6px;
    text-align: right;
    border-bottom: 1px solid #f0f0f0;
    font-size: 9px;
  }

  table.gst tr.alt td { background: #fafafa; }
  table.gst th:first-child, table.gst td:first-child { text-align: left; }
  ` : ''}

  .payment-section {
    padding: 12px 32px 0;
  }

  .pmt-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    margin-bottom: 6px;
  }

  table.payments {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }

  table.payments th {
    background: #f0f0f0;
    color: #555;
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 5px 6px;
  }

  table.payments td {
    padding: 4px 6px;
    border-bottom: 1px solid #f0f0f0;
    color: #1a1a1a;
  }

  table.payments tr.alt td { background: #fafafa; }

  .amount-words {
    padding: 12px 32px 0;
    font-size: 10px;
    color: #555;
    border-top: 1px solid #e0e0e0;
    margin-top: 12px;
    padding-top: 12px;
  }

  .amount-words strong { color: #1a1a1a; }

  .footer {
    padding: 20px 32px 24px;
    border-top: 1px solid #e0e0e0;
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .footer-left { font-size: 9px; color: #888; line-height: 1.6; }
  .footer-right { text-align: right; }

  .footer-thanks {
    font-size: 14px;
    font-weight: 700;
    color: #1a5c4a;
  }

  .footer-sub {
    font-size: 9px;
    color: #888;
    margin-top: 2px;
  }

  .signature { margin-top: 24px; }
  .signature-line {
    width: 140px;
    border-top: 1px solid #1a1a1a;
    margin-top: 32px;
    margin-left: auto;
  }
  .signature-label {
    font-size: 9px;
    color: #666;
    text-align: right;
    margin-top: 4px;
  }

  .terms {
    padding: 0 32px;
    font-size: 8px;
    color: #999;
    line-height: 1.6;
  }

  .declaration {
    padding: 10px 0;
    font-size: 8px;
    color: #888;
    border-top: 1px dashed #ddd;
    margin-top: 10px;
    line-height: 1.6;
  }

  @media print {
    body { background: #fff; padding: 0; }
    .invoice { max-width: 100%; }
    .top-strip { height: 4px; }
  }
</style>
</head>
<body>
  <div class="invoice">
    <div class="top-strip"></div>

    <div class="header">
      <div class="header-left">
        <div class="shop-name">${shopName}</div>
        <div class="shop-tagline">Tax Invoice / Bill of Supply</div>
      </div>
      <div class="header-right">
        <div class="invoice-title">Invoice</div>
        <div class="invoice-sub">Original for Recipient</div>
        <div class="status-badge">${formatStatus(bill.payment_status)}</div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-left">
        <div class="info-label">Invoice No.</div>
        <div class="info-value">${bill.bill_number}</div>
        <div class="info-value-light">${new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
      <div class="info-right">
        <div class="info-label">Payment Method</div>
        <div class="info-value">${formatPaymentMethod(bill.payment_method)}</div>
        <div class="info-value-light">${new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>

    <div class="bill-to">
      <div class="bill-to-label">Bill To</div>
      <div class="bill-to-name">${bill.customer?.name || 'Walk-in Customer'}</div>
      ${bill.customer?.phone ? `<div class="bill-to-detail">Phone: ${bill.customer.phone}</div>` : ''}
      ${bill.customer?.address ? `<div class="bill-to-detail">${bill.customer.address}</div>` : ''}
    </div>

    <div class="items-section">
      <table class="items">
        <thead>
          <tr>
            <th style="width:24px;">#</th>
            <th>Description</th>
            <th style="width:32px;" class="center">Qty</th>
            <th style="width:48px;" class="right">Rate</th>
            ${hasGstItems ? '<th style="width:34px;" class="right">GST</th>' : ''}
            <th style="width:52px;" class="right">Amount</th>
            <th style="width:56px;" class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <div class="totals-section clearfix">
      <table class="totals">
        ${bill.notes ? `<tr><td class="label" style="font-style:italic; max-width:160px;" colspan="2">Note: ${bill.notes}</td></tr>` : ''}
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">₹${Number(bill.subtotal).toFixed(2)}</td>
        </tr>
        ${Number(bill.discount) > 0 ? `
        <tr>
          <td class="label">Discount${bill.discount_type === 'percentage' ? ` (${bill.discount_value}% OFF)` : ''}</td>
          <td class="value" style="color:#065f46;">-₹${Number(bill.discount).toFixed(2)}</td>
        </tr>` : ''}
        ${Number(bill.tax) > 0 ? `
        <tr>
          <td class="label">GST Total</td>
          <td class="value">₹${Number(bill.tax).toFixed(2)}</td>
        </tr>` : ''}
        <tr class="sep"><td colspan="2"><div class="sep-inner"></div></td></tr>
        <tr class="grand-total">
          <td class="label">Grand Total</td>
          <td class="value">₹${Number(bill.total).toFixed(2)}</td>
        </tr>
        ${Number(bill.paid_amount) > 0 ? `
        <tr class="paid">
          <td class="label">Paid</td>
          <td class="value">₹${Number(bill.paid_amount).toFixed(2)}</td>
        </tr>` : ''}
        ${Number(bill.due_amount) > 0 ? `
        <tr class="due">
          <td class="label">Due (Udhaar)</td>
          <td class="value">₹${Number(bill.due_amount).toFixed(2)}</td>
        </tr>` : ''}
      </table>
    </div>

    <div class="amount-words">
      <strong>Amount in Words:</strong> ${amountInWords(Number(bill.total))} Only
    </div>

    ${gstRows ? `
    <div class="gst-section">
      <div class="gst-title">GST Breakup</div>
      <table class="gst">
        <thead>
          <tr>
            <th style="text-align:left;">Rate</th>
            <th class="right">Taxable Value</th>
            <th class="right">CGST</th>
            <th class="right">SGST</th>
            <th class="right">Total Tax</th>
          </tr>
        </thead>
        <tbody>
          ${gstRows}
        </tbody>
      </table>
    </div>` : ''}

    ${bill.payments && bill.payments.length > 0 ? `
    <div class="payment-section">
      <div class="pmt-title">Payment History</div>
      <table class="payments">
        <thead>
          <tr>
            <th style="text-align:left;">Date</th>
            <th style="text-align:left;">Method</th>
            <th style="text-align:left;">Ref</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bill.payments.map((p, i) => {
            const d = p.payment_date ? new Date(p.payment_date) : null;
            const dateStr = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            return `
          <tr${i % 2 === 1 ? ' class="alt"' : ''}>
            <td>${dateStr}</td>
            <td>${formatPaymentMethod(p.payment_method)}</td>
            <td style="color:#888;">${p.reference || '—'}</td>
            <td style="text-align:right; font-weight:600;">₹${Number(p.amount).toFixed(2)}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <div class="footer">
      <div class="footer-left">
        ${shopName}<br>
        This is a computer-generated invoice
      </div>
      <div class="footer-right">
        <div class="footer-thanks">Thank You</div>
        <div class="footer-sub">Visit Again</div>
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-label">Authorised Signatory</div>
        </div>
      </div>
    </div>

    <div class="terms">
      <div class="declaration">
        This is a computer-generated invoice and does not require a physical signature.
        Goods once sold will not be taken back or exchanged. Subject to local jurisdiction.
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateInvoicePdf(bill: BillDetail, shopName?: string): Promise<string> {
  const html = invoiceHTML(bill, shopName || 'KhataFlow');
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

export async function shareInvoicePdf(bill: BillDetail, shopName?: string): Promise<void> {
  const uri = await generateInvoicePdf(bill, shopName);
  const title = `Invoice ${bill.bill_number} from ${shopName || ''}`;
  if (await shareViaIntent(uri, title)) return;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
  });
}

export async function shareOnWhatsApp(bill: BillDetail, shopName?: string): Promise<void> {
  const uri = await generateInvoicePdf(bill, shopName);
  const title = `Invoice ${bill.bill_number} from ${shopName || ''}`;
  if (await shareViaIntent(uri, title)) return;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share invoice ${bill.bill_number} with ${bill.customer?.name || 'customer'}`,
  });
}
