import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
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

/**
 * Bagian anggota / relasi untuk ekspor single-record (DOCX & PDF).
 * Ditampilkan sebagai tabel tersendiri di bawah tabel Field/Value utama.
 */
export interface MemberSection {
  title: string;
  columns: { key: string; header: string }[];
  rows: any[];
}

/**
 * Detail per entitas untuk ekspor daftar (MD & PDF).
 * Ditampilkan sebagai bagian rincian setelah tabel ringkasan utama.
 */
export interface EntityDetail {
  name: string;
  members: string[];
}

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

/** Label modul yang ditampilkan di nama file */
const MODULE_LABELS: Record<string, string> = {
  santri: 'Data Santri',
  kelas:  'Data Kelas',
  guru:   'Data Guru',
  seksi:  'Data Seksi',
};

/**
 * Bangun nama file yang enak dibaca manusia.
 * @param label - label lengkap sudah termasuk filter (bila ada), misal "Data Santri Kelas A"
 * @param ext - ekstensi tanpa titik
 */
function fileName(label: string, ext: string) {
  const date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const safe = `${label} ${date}`.replace(/[/\\:*?"<>|]/g, '-');
  return `${safe}.${ext}`;
}

/**
 * Nama file untuk ekspor daftar.
 * @param modul - 'santri'|'kelas'|'guru'|'seksi'
 * @param filterLabel - label filter yang aktif, kosong jika tidak ada filter
 */
function listFileName(modul: string, filterLabel: string, ext: string) {
  const base = MODULE_LABELS[modul] ?? modul;
  return fileName(filterLabel ? `${base} ${filterLabel}` : base, ext);
}

/**
 * Gambar brand strip + nama app + nama pesantren.
 * Mengembalikan posisi Y tepat di bawah elemen terakhir yang digambar
 * (baseline PESANTREN_NAME ~18 mm + ruang descender + jarak aman = 24 mm)
 * sehingga pemanggil selalu tahu titik mulai konten yang aman.
 */
function drawPdfBrand(doc: jsPDF): number {
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

  // Elemen terakhir: PESANTREN_NAME baseline di y=18 mm (fontSize 9 pt ≈ 3.2 mm tinggi).
  // Kembalikan 24 mm sebagai batas bawah aman setelah semua elemen kop.
  return 24;
}

/** Tulis header dokumen PDF dengan warna brand, kembalikan startY untuk tabel */
function drawPdfHeader(doc: jsPDF, title: string, subtitle: string): number {
  const brandBottom = drawPdfBrand(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  // Judul ditempatkan 2 mm di bawah batas bawah kop (brandBottom = 24 → y = 26)
  doc.text(title, 14, brandBottom + 2);

  // Kembalikan titik mulai tabel: 8 mm di bawah batas bawah kop (→ 32)
  return brandBottom + 8;
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

/**
 * Ekspor ke XLSX.
 * @param memberColumnKeys - key kolom yang berisi nilai multi-baris (dipisah \n).
 *   Kolom ini mendapat wrapText otomatis, lebar lebih lebar, dan tinggi baris
 *   disesuaikan dengan jumlah baris konten.
 */
export function exportToXlsx(
  modul: string,
  konteks: string,
  rows: any[],
  columns: { key: string; header: string }[],
  memberColumnKeys?: string[]
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

    // Lebar kolom: kolom anggota lebih lebar
    ws['!cols'] = columns.map(c => ({
      wch: memberColumnKeys?.includes(c.key) ? 45 : 22,
    }));

    // WrapText + tinggi baris untuk kolom anggota
    if (memberColumnKeys?.length) {
      const range = XLSX.utils.decode_range(ws['!ref']!);
      const memberColIndices = columns
        .map((c, i) => (memberColumnKeys.includes(c.key) ? i : -1))
        .filter(i => i >= 0);

      if (!ws['!rows']) ws['!rows'] = [];

      // Baris data mulai di index 4 (0: APP_NAME, 1: PESANTREN, 2: kosong, 3: header)
      for (let r = 4; r <= range.e.r; r++) {
        let maxLines = 1;
        for (const ci of memberColIndices) {
          const addr = XLSX.utils.encode_cell({ r, c: ci });
          if (ws[addr]) {
            try {
              ws[addr].s = { alignment: { wrapText: true, vertical: 'top' } };
            } catch {
              // Abaikan jika versi xlsx tidak mendukung style
            }
            const lines = String(ws[addr].v || '').split('\n').length;
            maxLines = Math.max(maxLines, lines);
          }
        }
        // Tinggi baris proporsional dengan jumlah baris konten (min 15pt)
        (ws['!rows'] as any[])[r] = { hpt: Math.max(15, maxLines * 14) };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modul);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    downloadBlob(blob, listFileName(modul, konteks, 'xlsx'));
    toast.success('File XLSX berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor XLSX: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── Markdown ────────────────────────────────────────────────────────────────

/**
 * Ekspor ke Markdown.
 * @param entityDetails - detail anggota per entitas. Jika diisi, tabel ringkasan
 *   tidak menyertakan kolom anggota; detail per entitas ditambahkan sebagai
 *   bagian rincian bertanda kepala (### Nama) dengan poin-poin di bawahnya.
 */
export function exportToMarkdown(
  modul: string,
  konteks: string,
  rows: any[],
  columns: { key: string; header: string }[],
  entityDetails?: EntityDetail[]
) {
  try {
    let md = `# ${APP_NAME}\n\n## ${PESANTREN_NAME}\n\n### ${modul.toUpperCase()} - ${konteks || 'Semua Data'}\n\n`;
    md += `Tanggal ekspor: ${new Date().toLocaleDateString('id-ID')}\n\n`;
    md += `Total data: ${rows.length}\n\n`;

    // Tabel ringkasan
    md += '| ' + columns.map(c => c.header).join(' | ') + ' |\n';
    md += '| ' + columns.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(r => {
      md += '| ' + columns.map(c =>
        String(r[c.key] ?? '').replace(/\|/g, '\\|').replace(/\n/g, '; ')
      ).join(' | ') + ' |\n';
    });

    // Bagian rincian anggota per entitas — setiap entitas punya tabel sendiri
    if (entityDetails?.some(d => d.members.length > 0)) {
      md += '\n\n---\n\n## Rincian Anggota\n\n';
      entityDetails.forEach((detail, i) => {
        if (!detail.members.length) return;
        md += `### ${i + 1}. ${detail.name}\n\n`;
        md += '| No. | Nama |\n';
        md += '| --- | --- |\n';
        detail.members.forEach((m, j) => {
          md += `| ${j + 1} | ${String(m).replace(/\|/g, '\\|')} |\n`;
        });
        md += '\n';
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, listFileName(modul, konteks, 'md'));
    toast.success('File Markdown berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor Markdown: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── PDF list view ────────────────────────────────────────────────────────────

/**
 * Ekspor daftar ke PDF.
 * @param entityDetails - detail anggota per entitas. Jika diisi, ditambahkan
 *   halaman rincian setelah tabel ringkasan utama, dengan judul per entitas
 *   dan daftar anggota berupa poin-poin.
 */
export function exportToPdf(
  modul: string,
  konteks: string,
  rows: any[],
  columns: { key: string; header: string }[],
  entityDetails?: EntityDetail[]
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

    // Halaman rincian anggota — setiap entitas punya mini-tabel autoTable sendiri
    if (entityDetails?.some(d => d.members.length > 0)) {
      doc.addPage();
      // brandBottom = 24 mm — batas bawah aman setelah seluruh elemen kop
      let brandBottom = drawPdfBrand(doc);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...TEXT_DARK);
      // Judul "Rincian Anggota" dimulai 4 mm di bawah batas bawah kop (→ y=28),
      // bukan 16 mm yang bertumpuk dengan PESANTREN_NAME di y=18.
      doc.text('Rincian Anggota', 14, brandBottom + 4);

      const ph = doc.internal.pageSize.getHeight();
      // curY: posisi Y saat ini — dimulai 11 mm setelah brandBottom (→ 35),
      // memberi jarak cukup di bawah judul "Rincian Anggota".
      let curY = brandBottom + 11;

      entityDetails.forEach((detail, idx) => {
        if (!detail.members.length) return;

        // Estimasi tinggi minimum: judul (6mm) + header + 1 baris ≈ 20mm
        const MIN_HEIGHT = 20;
        if (curY + MIN_HEIGHT > ph - 15) {
          doc.addPage();
          // Hitung ulang brandBottom dari kop yang baru digambar,
          // lalu mulai konten 6 mm di bawahnya — bukan angka tetap 14 mm
          // yang tertimpa oleh PESANTREN_NAME di y=18.
          brandBottom = drawPdfBrand(doc);
          curY = brandBottom + 6;
        }

        // Judul entitas
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...PRIMARY);
        doc.text(`${idx + 1}. ${detail.name}`, 14, curY);
        curY += 5;

        // Mini-tabel anggota — autoTable menangani pindah halaman internal secara otomatis
        autoTable(doc, {
          startY: curY,
          head: [['No.', 'Nama']],
          body: detail.members.map((m, i) => [String(i + 1), m]),
          theme: 'striped',
          headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
          bodyStyles: { fontSize: 8, textColor: TEXT_DARK },
          alternateRowStyles: { fillColor: BG_LIGHT },
          columnStyles: { 0: { cellWidth: 12, halign: 'center' } },
          didDrawCell(data) {
            if (data.section === 'head' && data.row.index === 0) {
              const { x, y, width, height } = data.cell;
              doc.setDrawColor(...ACCENT);
              doc.setLineWidth(0.4);
              doc.line(x, y + height, x + width, y + height);
            }
          },
          margin: { left: 14, right: 14 },
          tableLineWidth: 0,
        });

        // Posisi berikutnya = bawah tabel yang baru selesai + jarak 8mm
        curY = ((doc as any).lastAutoTable?.finalY ?? curY) + 8;
      });
    }

    addPdfFooter(doc);
    doc.save(listFileName(modul, konteks, 'pdf'));
    toast.success('File PDF berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor PDF: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── DOCX per-record ──────────────────────────────────────────────────────────

/**
 * Ekspor satu record ke DOCX.
 * @param memberSections - bagian anggota/relasi. Masing-masing ditampilkan
 *   sebagai tabel tersendiri (No. + kolom data) di bawah tabel Field/Value.
 */
export async function exportSingleToDocx(
  modul: string,
  id: string,
  fields: { label: string; value: any }[],
  title: string,
  memberSections?: MemberSection[]
) {
  try {
    const fieldParagraphs = fields.map(f => new Paragraph({
      children: [
        new TextRun({ text: `${f.label}: `, bold: true }),
        new TextRun(String(f.value ?? '-')),
      ],
      spacing: { after: 100 },
    }));

    // Elemen tambahan untuk setiap MemberSection
    const sectionElements: (Paragraph | Table)[] = [];
    if (memberSections?.length) {
      for (const section of memberSections) {
        if (!section.rows?.length) continue;

        sectionElements.push(
          new Paragraph({ text: '', spacing: { after: 100 } }),
          new Paragraph({
            children: [new TextRun({ text: section.title, bold: true, size: 22 })],
            spacing: { after: 120 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Baris header
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'No.', bold: true })] })],
                  }),
                  ...section.columns.map(col =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: col.header, bold: true })] })],
                    })
                  ),
                ],
              }),
              // Baris data
              ...section.rows.map((row, i) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: String(i + 1) })] }),
                    ...section.columns.map(col =>
                      new TableCell({
                        children: [new Paragraph({ text: String(row[col.key] ?? '-') })],
                      })
                    ),
                  ],
                })
              ),
            ],
          }),
        );
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: APP_NAME, heading: 'Title' as any }),
          new Paragraph({ text: PESANTREN_NAME, spacing: { after: 200 } }),
          new Paragraph({ text: title, heading: 'Heading1' as any }),
          new Paragraph({ text: `ID: ${id}`, spacing: { after: 200 } }),
          ...fieldParagraphs,
          ...sectionElements,
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    // Nama file: judul dokumen (tanpa tanda " - ") + tanggal
    downloadBlob(blob, fileName(title.replace(/\s*[-–]\s*/g, ' '), 'docx'));
    toast.success('File DOCX berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor DOCX: ' + (e?.message || 'Error tidak diketahui'));
  }
}

// ─── PDF per-record ───────────────────────────────────────────────────────────

/**
 * Ekspor satu record ke PDF.
 * @param memberSections - bagian anggota/relasi. Masing-masing ditampilkan
 *   sebagai tabel autoTable tersendiri di bawah tabel Field/Value utama.
 */
export async function exportSingleToPdf(
  modul: string,
  id: string,
  fields: { label: string; value: any }[],
  title: string,
  photoPath?: string | null,
  memberSections?: MemberSection[]
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

    // Render setiap MemberSection sebagai autoTable terpisah di bawah tabel utama
    if (memberSections?.length) {
      for (const section of memberSections) {
        if (!section.rows?.length) continue;

        const prevFinalY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
        const ph = doc.internal.pageSize.getHeight();

        // Posisi judul bagian; pindah halaman kalau perlu
        let sectionTitleY = prevFinalY + 8;
        if (sectionTitleY > ph - 30) {
          doc.addPage();
          sectionTitleY = 18;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...TEXT_DARK);
        doc.text(section.title, 14, sectionTitleY);

        autoTable(doc, {
          startY: sectionTitleY + 4,
          head: [['No.', ...section.columns.map(c => c.header)]],
          body: section.rows.map((r, i) => [
            String(i + 1),
            ...section.columns.map(c => String(r[c.key] ?? '-')),
          ]),
          theme: 'striped',
          headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 9, lineWidth: 0 },
          bodyStyles: { fontSize: 9, textColor: TEXT_DARK },
          alternateRowStyles: { fillColor: BG_LIGHT },
          margin: { left: 14, right: 14 },
          tableLineWidth: 0,
        });
      }
    }

    addPdfFooter(doc);
    // Nama file: judul dokumen (tanpa tanda " - ") + tanggal
    doc.save(fileName(title.replace(/\s*[-–]\s*/g, ' '), 'pdf'));
    toast.success('File PDF berhasil diunduh');
  } catch (e: any) {
    toast.error('Gagal ekspor PDF: ' + (e?.message || 'Error tidak diketahui'));
  }
}
