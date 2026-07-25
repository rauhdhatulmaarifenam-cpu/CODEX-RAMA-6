import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { getSignedUrl } from '../../lib/storage';

// Brand tokens
const PRIMARY   = [11, 93, 76]    as [number, number, number]; // #0B5D4C
const ACCENT    = [201, 162, 39]  as [number, number, number]; // #C9A227
const BG_LIGHT  = [250, 248, 243] as [number, number, number]; // #FAF8F3
const TEXT_DARK = [31, 42, 40]    as [number, number, number]; // #1F2A28
const WHITE     = [255, 255, 255] as [number, number, number];
const APP_NAME = 'Codex — RAMA 6';
const PESANTREN_NAME = "Raudhatul Ma'arif 6";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface PdfPhoto {
  dataUrl: string;
}

/**
 * Ambil foto dari Supabase Storage lalu normalisasi ke JPEG melalui canvas
 * tersembunyi. Ini membuat PNG/WebP/JPEG tetap aman untuk jsPDF.
 */
async function loadPdfPhoto(photoPath?: string | null): Promise<PdfPhoto | null> {
  if (!photoPath?.trim()) return null;

  const signedUrl = await getSignedUrl(photoPath);
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Gagal mengambil foto (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.crossOrigin = 'anonymous';

  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(new Error('Foto tidak memiliki dimensi yang valid'));
          return;
        }
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => reject(new Error('Browser tidak dapat membaca foto'));
      image.src = objectUrl;
    });

    // Canvas 3:4 portrait — konsisten dengan rasio kotak foto di PDF.
    const canvasW = 600;
    const canvasH = 800;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);

    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D tidak tersedia');
      context.fillStyle = '#FAF8F3';
      context.fillRect(0, 0, canvasW, canvasH);

      // Contain: seluruh foto terlihat, rasio asli tetap, tanpa crop/distorsi.
      const scale = Math.min(canvasW / dimensions.width, canvasH / dimensions.height);
      const drawWidth = dimensions.width * scale;
      const drawHeight = dimensions.height * scale;
      const drawX = (canvasW - drawWidth) / 2;
      const drawY = (canvasH - drawHeight) / 2;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      };
    } finally {
      canvas.remove();
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fileName(modul: string, konteks: string, ext: string) {
  const date = new Date().toISOString().slice(0, 10);
  const safeKonteks = konteks ? `_${konteks.replace(/[^a-zA-Z0-9-_]/g, '_')}` : '';
  return `${modul}${safeKonteks}_${date}.${ext}`;
}

function drawPdfBrand(doc: jsPDF) {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY);
  doc.text(APP_NAME, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(PESANTREN_NAME, 14, 18);
}

/** Tulis header dokumen PDF dengan warna brand, kembalikan startY untuk tabel */
function drawPdfHeader(doc: jsPDF, title: string, subtitle: string): number {
  drawPdfBrand(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title, 14, 26);

  return 32;
}

/** Gambar kotak foto dengan rasio bebas (portrait 3:4 untuk pas foto). */
function drawPhotoFrame(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...BG_LIGHT);
  doc.setDrawColor(210, 207, 198);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
}

function drawPhotoPlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  drawPhotoFrame(doc, x, y, w, h);
  const neutral = [125, 132, 130] as [number, number, number];
  doc.setFillColor(...neutral);
  // Kepala: posisi dan radius berdasarkan tinggi kotak
  doc.circle(x + w / 2, y + h * 0.30, h * 0.10, 'F');
  // Badan: lebar berdasarkan lebar kotak, tinggi berdasarkan tinggi kotak
  doc.ellipse(x + w / 2, y + h * 0.65, w * 0.20, h * 0.16, 'F');
}

function drawPersonalPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  photo: PdfPhoto | null,
) {
  drawPdfBrand(doc);

  // Pas foto 3:4 — lebar 30 mm, tinggi 40 mm
  const photoX = 14;
  const photoY = 28;
  const photoW = 30;
  const photoH = 40;
  const textX = photoX + photoW + 6; // mulai teks di kanan foto

  if (photo) {
    // Canvas sudah 3:4 dan berisi foto dengan contain.
    drawPhotoFrame(doc, photoX, photoY, photoW, photoH);
    doc.addImage(photo.dataUrl, 'JPEG', photoX, photoY, photoW, photoH, undefined, 'FAST');
  } else {
    drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title, textX, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, textX, 47);
  return photoY + photoH + 6; // 74 mm — pastikan tabel mulai di bawah foto
}

function addPdfFooter(doc: jsPDF) {
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(...ACCENT);
    doc.rect(0, ph - 2, pw, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${APP_NAME} — ${PESANTREN_NAME}   |   Halaman ${i} / ${pageCount}`, 14, ph - 4);
  }
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

export function exportToXlsx(
  modul: string,
  konteks: string,
  rows: any[],
  columns: { key: string; header: string }[]
) {
  try {
    const data = rows.map(r => columns.map(c => r[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([
      [APP_NAME],
      [PESANTREN_NAME],
      [],
      columns.map(c => c.header),
      ...data,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modul);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    downloadBlob(blob, fileName(modul, konteks, 'xlsx'));
    toast.success('File XLSX berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor XLSX: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── Markdown ────────────────────────────────────────────────────────────────

export function exportToMarkdown(
  modul: string,
  konteks: string,
  rows: any[],
  columns: { key: string; header: string }[]
) {
  try {
    let md = `# ${APP_NAME}\n\n## ${PESANTREN_NAME}\n\n### ${modul.toUpperCase()} - ${konteks || 'Semua Data'}\n\n`;
    md += `Tanggal ekspor: ${new Date().toLocaleDateString('id-ID')}\n\n`;
    md += `Total data: ${rows.length}\n\n`;
    md += '| ' + columns.map(c => c.header).join(' | ') + ' |\n';
    md += '| ' + columns.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(r => {
      md += '| ' + columns.map(c => String(r[c.key] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, fileName(modul, konteks, 'md'));
    toast.success('File Markdown berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor Markdown: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── PDF list view ────────────────────────────────────────────────────────────

export function exportToPdf(
  modul: string,
  konteks: string,
  rows: any[],
  columns: { key: string; header: string }[]
) {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const subtitle = `Tanggal: ${new Date().toLocaleDateString('id-ID')} | Total: ${rows.length}`;
    const startY = drawPdfHeader(doc, `${modul.toUpperCase()} — ${konteks || 'Laporan'}`, subtitle);

    autoTable(doc, {
      startY,
      head: [columns.map(c => c.header)],
      body: rows.map(r => columns.map(c => String(r[c.key] ?? ''))),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
      bodyStyles: { fontSize: 8, textColor: TEXT_DARK },
      alternateRowStyles: { fillColor: BG_LIGHT },
      didDrawCell(data) {
        if (data.section === 'head' && data.row.index === 0) {
          const { x, y, width, height } = data.cell;
          doc.setDrawColor(...ACCENT);
          doc.setLineWidth(0.5);
          doc.line(x, y + height, x + width, y + height);
        }
      },
      margin: { left: 10, right: 10 },
      tableLineWidth: 0,
    });

    addPdfFooter(doc);
    doc.save(fileName(modul, konteks, 'pdf'));
    toast.success('File PDF berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor PDF: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── DOCX per-record ──────────────────────────────────────────────────────────

export async function exportSingleToDocx(
  modul: string,
  id: string,
  fields: { label: string; value: any }[],
  title: string
) {
  try {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: APP_NAME, heading: 'Title' as any }),
          new Paragraph({ text: PESANTREN_NAME, spacing: { after: 200 } }),
          new Paragraph({ text: title, heading: 'Heading1' as any }),
          new Paragraph({ text: `ID: ${id}`, spacing: { after: 200 } }),
          ...fields.map(f => new Paragraph({
            children: [
              new TextRun({ text: `${f.label}: `, bold: true }),
              new TextRun(String(f.value ?? '-')),
            ],
            spacing: { after: 100 },
          })),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, fileName(modul, id, 'docx'));
    toast.success('File DOCX berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor DOCX: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── PDF per-record ───────────────────────────────────────────────────────────

export async function exportSingleToPdf(
  modul: string,
  id: string,
  fields: { label: string; value: any }[],
  title: string,
  photoPath?: string | null,
) {
  try {
    let photo: PdfPhoto | null = null;
    if (photoPath?.trim()) {
      try {
        photo = await loadPdfPhoto(photoPath);
      } catch (error) {
        console.warn('Foto PDF tidak dapat dimuat, menggunakan placeholder.', error);
      }
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const subtitle = `ID: ${id}   |   ${new Date().toLocaleDateString('id-ID')}`;
    const startY = modul === 'santri' || modul === 'guru'
      ? drawPersonalPdfHeader(doc, title, subtitle, photo)
      : drawPdfHeader(doc, title, subtitle);

    autoTable(doc, {
      startY,
      head: [['Field', 'Value']],
      body: fields.map(f => [f.label, String(f.value ?? '-')]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 9, lineWidth: 0 },
      bodyStyles: { fontSize: 9, textColor: TEXT_DARK },
      alternateRowStyles: { fillColor: BG_LIGHT },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      didDrawCell(data) {
        if (data.section === 'head' && data.row.index === 0) {
          const { x, y, width, height } = data.cell;
          doc.setDrawColor(...ACCENT);
          doc.setLineWidth(0.5);
          doc.line(x, y + height, x + width, y + height);
        }
      },
      margin: { left: 14, right: 14 },
      tableLineWidth: 0,
    });

    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(...ACCENT);
    doc.rect(0, ph - 2, pw, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${APP_NAME} — ${PESANTREN_NAME}`, 14, ph - 4);

    doc.save(fileName(modul, id, 'pdf'));
    toast.success('File PDF berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor PDF: ' + (e?.message || 'Error tidak diketahui'));
  }
}
