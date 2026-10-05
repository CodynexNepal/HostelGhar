// ─────────────────────────────────────────────────────────────
// FILE: report-export.util.ts
// PURPOSE: Zero-dependency CSV + minimal PDF builders for Reports.
// ─────────────────────────────────────────────────────────────

/** Escape one CSV cell per RFC-4180. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Builds a CSV string with BOM (Excel-friendly). */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Sanitizes a filename segment. */
export function safeFileSegment(value: string, fallback = 'report'): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' | ')
    .slice(0, 250);
}

function fitCell(text: string, colWidthPt: number, fontSize: number): string {
  const maxChars = Math.max(4, Math.floor(colWidthPt / (fontSize * 0.52)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

export interface TabularPdfOptions {
  title: string;
  subtitle?: string | undefined;
  headers: string[];
  rows: Array<Array<unknown>>;
  weights?: number[] | undefined;
  landscape?: boolean | undefined;
}

export function buildTabularPdf(options: TabularPdfOptions): Buffer {
  const { title, subtitle, headers, rows } = options;
  const landscape = options.landscape ?? headers.length > 5;
  const pageW = landscape ? 842 : 595;
  const pageH = landscape ? 595 : 842;
  const margin = 36;
  const usableW = pageW - margin * 2;
  const fontSize = 8.5;
  const headerSize = 9.5;
  const titleSize = 16;
  const subSize = 10;
  const rowH = 17;

  const weights =
    options.weights && options.weights.length === headers.length
      ? options.weights
      : headers.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const colWidths = weights.map((w) => (usableW * w) / sum);
  const colX: number[] = [];
  let acc = margin;
  for (const w of colWidths) {
    colX.push(acc);
    acc += w;
  }

  const stringRows = rows.map((r) =>
    r.map((c) => (c === null || c === undefined ? '' : String(c))),
  );
  const firstTop = pageH - margin - titleSize - (subtitle ? subSize + 6 : 4) - 22 - headerSize - 8;
  const restTop = pageH - margin - 24 - headerSize - 8;
  const pages: Array<Array<Array<string>>> = [];
  let idx = 0;
  let pi = 0;
  while (idx < stringRows.length || pages.length === 0) {
    const top = pi === 0 ? firstTop : restTop;
    const cap = Math.max(1, Math.floor((top - (margin + 26)) / rowH));
    const chunk: Array<Array<string>> = [];
    for (let i = 0; i < cap && idx < stringRows.length; i++, idx++) {
      chunk.push(stringRows[idx] as Array<string>);
    }
    pages.push(chunk);
    pi++;
    if (idx >= stringRows.length) break;
  }

  const streams: string[] = pages.map((pageRows, pageNum) => {
    let y: number;
    let s = '';
    if (pageNum === 0) {
      y = pageH - margin - titleSize;
      s += `BT /F2 ${titleSize} Tf ${margin} ${y} Td (${pdfEscape(title)}) Tj ET\n`;
      y -= 6;
      if (subtitle) {
        s += `BT /F1 ${subSize} Tf 0.25 0.35 0.5 rg ${margin} ${y - subSize} Td (${pdfEscape(subtitle)}) Tj ET\n0 0 0 rg\n`;
        y -= subSize + 8;
      } else {
        y -= 6;
      }
      y -= 14;
    } else {
      y = pageH - margin - 20;
      s += `BT /F1 9 Tf 0.4 0.45 0.55 rg ${margin} ${y} Td (${pdfEscape(`${title} (cont.)`)}) Tj ET\n0 0 0 rg\n`;
      y -= 18;
    }
    s += `0.93 0.95 1 rg ${margin} ${y - 4} ${usableW} ${rowH} re f\n`;
    s += `0.2 0.3 0.55 RG 0.5 w ${margin} ${y - 4} ${usableW} ${rowH} re S\n`;
    headers.forEach((h, i) => {
      const x = (colX[i] ?? margin) + 4;
      s += `BT /F2 ${headerSize} Tf ${x.toFixed(1)} ${(y + 4).toFixed(1)} Td (${pdfEscape(fitCell(h, colWidths[i] ?? 80, headerSize))}) Tj ET\n`;
    });
    y -= rowH;
    pageRows.forEach((cells, ri) => {
      if (ri % 2 === 1) s += `0.96 0.97 0.99 rg ${margin} ${y - 4} ${usableW} ${rowH} re f\n`;
      s += `0.85 0.87 0.9 RG 0.4 w ${margin} ${y - 4} ${usableW} ${rowH} re S\n`;
      cells.forEach((c, i) => {
        const x = (colX[i] ?? margin) + 4;
        s += `BT /F1 ${fontSize} Tf ${x.toFixed(1)} ${(y + 4).toFixed(1)} Td (${pdfEscape(fitCell(c, (colWidths[i] ?? 80) - 8, fontSize))}) Tj ET\n`;
      });
      y -= rowH;
    });
    if (pageRows.length === 0) {
      s += `BT /F1 ${fontSize} Tf ${margin} ${y} Td (No records for selected filters.) Tj ET\n`;
    }
    const footer = `Page ${pageNum + 1} of ${pages.length}  |  HostelGhar  |  ${new Date().toISOString().slice(0, 10)}`;
    s += `BT /F1 7.5 Tf 0.45 0.5 0.6 rg ${margin} ${margin - 16} Td (${pdfEscape(footer)}) Tj ET\n0 0 0 rg\n`;
    return s;
  });

  const contentStartId = 4;
  const pageStartId = contentStartId + streams.length;
  const fontRegId = pageStartId + streams.length;
  const fontBoldId = fontRegId + 1;
  const maxId = fontBoldId;
  const kids = streams.map((_, i) => `${pageStartId + i} 0 R`).join(' ');
  const objs = new Map<number, string>();
  objs.set(1, `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objs.set(2, `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${streams.length} >>\nendobj`);
  streams.forEach((stream, i) => {
    const cid = contentStartId + i;
    const pid = pageStartId + i;
    objs.set(cid, `${cid} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream\nendobj`);
    objs.set(
      pid,
      `${pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${cid} 0 R >>\nendobj`,
    );
  });
  // Id 3 intentionally unused (keeps xref dense, viewers ignore gaps).
  objs.set(3, `3 0 obj\n<< >>\nendobj`);
  objs.set(fontRegId, `${fontRegId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objs.set(fontBoldId, `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  let body = '%PDF-1.4\n%@@@\n';
  const offsets: number[] = [0];
  for (let id = 1; id <= maxId; id++) {
    const obj = objs.get(id);
    if (!obj) continue;
    offsets[id] = Buffer.byteLength(body, 'utf8');
    body += `${obj}\n`;
  }
  const xrefPos = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    body += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}

