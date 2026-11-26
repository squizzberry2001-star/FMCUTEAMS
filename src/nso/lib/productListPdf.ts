import { ReportData, TransactionSet } from './types';

function safe(value?: string | number) {
  const text = String(value ?? '-').trim();
  return text || '-';
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export async function exportProductListPdf(report: ReportData) {
  if (typeof window === 'undefined') return;
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const gap = 14;
  const voucherWidth = pageWidth - margin * 2;
  const voucherHeight = 164;
  let y = margin;

  function drawHeader() {
    const facilitator = [report.general.facilitator, report.general.facilitator2].filter(Boolean).join(' / ') || '-';
    const subtitle = [
      `Toko: ${safe(report.storeName)}`,
      `SL: ${safe(report.general.storeLeader)}`,
      `Kode: ${safe(report.general.storeCode || report.storeKey)}`,
      `AM: ${safe(report.general.areaManager)}`,
      `RM: ${safe(report.general.regionalManager)}`,
      `Store Type: ${safe(report.general.storeType)}`,
      `MPA/MPS: ${safe(report.general.mpaMps)}`,
      `Tanggal: ${formatDate(report.general.date)}`,
      `Fasilitator: ${facilitator}`
    ];
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Reservasi List Penggunaan Produk', margin, 20);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.text(subtitle.join('  |  '), margin, 34, { maxWidth: pageWidth - margin * 2 });
  }

  function newPageIfNeeded() {
    if (y + voucherHeight <= pageHeight - margin) return;
    pdf.addPage('a4', 'portrait');
    y = margin;
    drawHeader();
    y += 24;
  }

  function drawVoucher(groupTitle: string, transaction: TransactionSet, transactionIndex: number) {
    newPageIfNeeded();
    const x = margin;
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(x, y, voucherWidth, voucherHeight, 8, 8);

    pdf.setFillColor(0, 166, 81);
    pdf.roundedRect(x + 10, y + 10, 32, 12, 3, 3, 'F');
    pdf.setFillColor(0, 114, 188);
    pdf.roundedRect(x + 10, y + 26, 32, 12, 3, 3, 'F');
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(`${groupTitle} - TRANSAKSI ${transactionIndex + 1}`, x + 54, y + 23);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const targetDisp = (transaction.targetTime === '00:05:00' || transaction.targetTime === '00:05') ? '05:00' : (transaction.targetTime || '05:00');
    pdf.text(`Label: ${safe(transaction.label)}   |   Target: ${safe(targetDisp)}   |   Actual: ${safe(transaction.actualTime)}`, x + 54, y + 38);

    const tableX = x + 10;
    const tableY = y + 54;
    const colNo = 28;
    const colArticle = 72;
    const colQty = 36;
    const colProduct = voucherWidth - 20 - colNo - colArticle - colQty;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(tableX, tableY, voucherWidth - 20, 20, 'F');
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(tableX, tableY, voucherWidth - 20, 20);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('No', tableX + 6, tableY + 13);
    pdf.text('Artikel', tableX + colNo + 6, tableY + 13);
    pdf.text('Nama Produk', tableX + colNo + colArticle + 6, tableY + 13);
    pdf.text('Qty', tableX + colNo + colArticle + colProduct + 8, tableY + 13);

    let rowY = tableY + 20;
    const products = transaction.products.length ? transaction.products : [{ id: 'empty', product: '-', qty: 0 }];
    products.slice(0, 6).forEach((product, index) => {
      const rowHeight = 16;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.7);
      pdf.rect(tableX, rowY, voucherWidth - 20, rowHeight);
      pdf.text(String(index + 1), tableX + 6, rowY + 11);
      pdf.text(safe(product.article), tableX + colNo + 6, rowY + 11);
      const lines = pdf.splitTextToSize(safe(product.product), colProduct - 10) as string[];
      pdf.text(lines.slice(0, 2), tableX + colNo + colArticle + 6, rowY + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(safe(product.qty), tableX + colNo + colArticle + colProduct + 9, rowY + 11);
      rowY += rowHeight;
    });
    if (products.length > 6) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.text(`+${products.length - 6} produk lain`, tableX + 6, y + voucherHeight - 10);
    }
    pdf.setTextColor(15, 23, 42);
    y += voucherHeight + gap;
  }

  drawHeader();
  y += 24;
  report.speedGroups.forEach((group) => {
    group.transactions.slice(0, 4).forEach((transaction, transactionIndex) => drawVoucher(group.title, transaction, transactionIndex));
  });

  pdf.setProperties({ title: `Reservasi List Penggunaan Produk - ${report.storeName}` });
  pdf.save(`Reservasi Produk - ${sanitizeFileName(report.storeName)}.pdf`);
}
