import { ProductCategory, ReportData } from './types';

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

function aggregateUsage(report: ReportData, category: ProductCategory) {
  const map = new Map<string, { article: string; name: string; qty: number }>();
  report.speedGroups.forEach((group) => {
    group.transactions.forEach((transaction) => {
      transaction.products.forEach((product) => {
        const productCategory = product.category ?? (product.product.toLowerCase().includes('ice') ? 'Beverage' : 'Kitchen');
        if (productCategory !== category) return;
        const key = `${product.article ?? ''}-${product.product}`;
        const current = map.get(key) ?? { article: product.article ?? '', name: product.product, qty: 0 };
        current.qty += Math.max(1, Number(product.qty || 1));
        map.set(key, current);
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function reportInfoRows(report: ReportData) {
  return [
    ['Nama Toko', '', ':', report.storeName],
    ['Store Leader', '', ':', report.general.storeLeader || '-'],
    ['Kode Toko', '', ':', report.general.storeCode || report.storeKey],
    ['Area Manager', '', ':', report.general.areaManager || '-'],
    ['Regional Manager', '', ':', report.general.regionalManager || '-'],
    ['Store Type', '', ':', report.general.storeType || '-'],
    ['MPA/MPS', '', ':', report.general.mpaMps || '-'],
    ['Tanggal Pelaksanaan', '', ':', report.general.date || '-'],
    ['Fasilitator', '', ':', [report.general.facilitator, report.general.facilitator2].filter(Boolean).join(' / ') || '-']
  ];
}

function buildSheetRows(report: ReportData, category: ProductCategory, signer: string) {
  const usage = aggregateUsage(report, category);
  const rows: (string | number)[][] = [
    ['RESERVASI LIST PENGGUNAAN PRODUK', '', '', '', '', 'Nomor: FRM/FMI/HR-TR/038/R00'],
    ['NEW STORE OPENING', '', '', '', '', 'Tgl. Efektif: 25 Maret 2025'],
    [],
    ...reportInfoRows(report),
    [],
    ['NO', 'NO. ARTIKEL', 'NAMA MENU / RAW MATERIAL', 'TOTAL QTY', 'KATEGORI', 'KETERANGAN'],
    ...usage.map((item, index) => [index + 1, item.article, item.name, item.qty, category, '']),
    [],
    ['', '', '', '', 'Tanda Tangan Digital', signer || '-']
  ];
  return rows;
}

function buildLeftoverRows(report: ReportData, signer: string) {
  const rows: (string | number)[][] = [
    ['SISA PRODUK SETELAH SIMULASI NSO', '', '', '', 'Tanda Tangan Digital', signer || '-'],
    [],
    ...reportInfoRows(report),
    [],
    ['NO', 'NO. ARTIKEL', 'NAMA PRODUK', 'QTY SISA', 'KATEGORI', 'SUMBER INPUT'],
    ...((report.leftoverProducts ?? []).filter((item) => item.product).map((item, index) => [
      index + 1,
      item.article || '',
      item.product,
      Number(item.qty || 0),
      item.category || '',
      item.source || 'facilitator'
    ]))
  ];
  return rows;
}

function styleSheet(XLSX: any, worksheet: any) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];
      if (!cell) continue;
      const isHeader = row === 0 || row === 1 || (String(cell.v ?? '').toUpperCase() === String(cell.v ?? '') && row > 10 && col < 6);
      cell.s = {
        ...(cell.s ?? {}),
        font: isHeader ? { bold: true } : undefined,
        border: {
          top: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } },
          bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } }
        },
        alignment: { vertical: 'top', wrapText: true }
      };
    }
  }
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 48 },
    { wch: 12 },
    { wch: 18 },
    { wch: 34 }
  ];
}

export async function exportProductUsageExcel(report: ReportData) {
  if (typeof window === 'undefined') return;
  const signerInput = window.prompt('Masukkan nama tanda tangan digital sebelum export XLS:', report.general.facilitator || '');
  if (signerInput === null) return;
  const signer = signerInput.trim();
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  (['Beverage', 'Kitchen'] as ProductCategory[]).forEach((category) => {
    const worksheet = XLSX.utils.aoa_to_sheet(buildSheetRows(report, category, signer));
    styleSheet(XLSX, worksheet);
    XLSX.utils.book_append_sheet(workbook, worksheet, category);
  });
  const leftoverSheet = XLSX.utils.aoa_to_sheet(buildLeftoverRows(report, signer));
  styleSheet(XLSX, leftoverSheet);
  XLSX.utils.book_append_sheet(workbook, leftoverSheet, 'Sisa Produk');
  XLSX.writeFile(workbook, `Reservasi List Penggunaan Produk - ${sanitizeFileName(report.storeName)}.xlsx`);
}
