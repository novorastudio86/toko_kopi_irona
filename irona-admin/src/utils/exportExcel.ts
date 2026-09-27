export type ExcelColumn<T> = {
  header: string;
  /** Lebar kolom (karakter) */
  width?: number;
  type?: 'text' | 'currency' | 'number' | 'date';
  value: (row: T) => string | number | Date | null;
};

export type ExcelSheet<T> = {
  name: string;
  columns: ExcelColumn<T>[];
  rows: T[];
};

/**
 * Ekspor laporan ke Excel (.xlsx). exceljs dimuat hanya saat tombol Ekspor diklik.
 * - title & subtitle ditulis di atas tabel (mis. judul laporan & periode)
 * - summary: pasangan label–nilai ringkasan di bawah judul
 */
export async function exportToExcel<T>(input: {
  fileName: string;
  title: string;
  subtitle?: string;
  summary?: [string, string | number][];
  sheets: ExcelSheet<T>[];
}): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Irona Kopi — Web Admin';
  wb.created = new Date();

  input.sheets.forEach((sheet, sheetIndex) => {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    let r = 1;

    ws.getCell(r, 1).value = input.title;
    ws.getCell(r, 1).font = { bold: true, size: 14 };
    r++;
    if (input.subtitle) {
      ws.getCell(r, 1).value = input.subtitle;
      ws.getCell(r, 1).font = { color: { argb: 'FF64748B' } };
      r++;
    }
    // Ringkasan hanya di sheet pertama
    if (sheetIndex === 0 && input.summary?.length) {
      r++;
      input.summary.forEach(([label, value]) => {
        ws.getCell(r, 1).value = label;
        ws.getCell(r, 1).font = { color: { argb: 'FF475569' } };
        const cell = ws.getCell(r, 2);
        cell.value = value;
        cell.font = { bold: true };
        if (typeof value === 'number') cell.numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0';
        r++;
      });
    }
    r++;

    const headerRow = ws.getRow(r);
    sheet.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle' };
      ws.getColumn(i + 1).width = col.width ?? Math.max(12, col.header.length + 2);
    });
    r++;

    sheet.rows.forEach((row) => {
      const excelRow = ws.getRow(r);
      sheet.columns.forEach((col, i) => {
        const cell = excelRow.getCell(i + 1);
        const raw = col.value(row);
        // exceljs menyimpan tanggal dalam UTC: geser ke tengah malam UTC supaya tanggal WIB tidak mundur sehari
        cell.value =
          raw instanceof Date
            ? new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()))
            : (raw as any);
        if (col.type === 'currency') cell.numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0';
        if (col.type === 'number') cell.numFmt = '#,##0.###';
        if (col.type === 'date') cell.numFmt = 'dd/mm/yyyy';
      });
      r++;
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = input.fileName.endsWith('.xlsx') ? input.fileName : `${input.fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
