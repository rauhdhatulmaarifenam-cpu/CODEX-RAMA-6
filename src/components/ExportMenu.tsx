import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileSpreadsheet, FileText, FileType, File as FileIcon } from 'lucide-react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onExport: (type: 'xlsx' | 'md' | 'pdf' | 'docx') => void;
  single?: boolean;
}

const MENU_W = 224; // w-56 = 14rem @ 16px base
const MARGIN = 8;   // minimum distance from viewport edge

export function ExportMenu({ onExport, single }: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const MENU_H = single ? 88 : 128; // estimated height based on item count

  const recalc = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    // Default: right-aligned, below button
    let top = r.bottom + 8;
    let left = r.right - MENU_W;

    // Clamp horizontally
    if (left < MARGIN) left = MARGIN;
    if (left + MENU_W > vpW - MARGIN) left = vpW - MENU_W - MARGIN;

    // If not enough space below, flip above button
    if (top + MENU_H > vpH - MARGIN) top = r.top - MENU_H - 8;
    if (top < MARGIN) top = MARGIN;

    setMenuStyle({ top, left });
  }, [MENU_H]);

  useEffect(() => {
    if (!open) return;
    recalc();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open, recalc]);

  return (
    <div ref={triggerRef} className="inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(v => !v)}
        leftIcon={<Download className="w-4 h-4" />}
      >
        Ekspor
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop to close on outside click */}
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

            <motion.div
              style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: MENU_W, zIndex: 40 }}
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="bg-surface rounded-xl shadow-soft-lg border border-border/60 p-1"
            >
              {!single ? (
                <>
                  <button
                    onClick={() => { onExport('xlsx'); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background text-sm text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" /> XLSX (tabel penuh)
                  </button>
                  <button
                    onClick={() => { onExport('pdf'); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background text-sm text-left"
                  >
                    <FileText className="w-4 h-4 shrink-0" /> PDF (laporan)
                  </button>
                  <button
                    onClick={() => { onExport('md'); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background text-sm text-left"
                  >
                    <FileType className="w-4 h-4 shrink-0" /> Markdown (ringkas)
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { onExport('docx'); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background text-sm text-left"
                  >
                    <FileIcon className="w-4 h-4 shrink-0" /> DOCX (profil)
                  </button>
                  <button
                    onClick={() => { onExport('pdf'); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background text-sm text-left"
                  >
                    <FileText className="w-4 h-4 shrink-0" /> PDF (kartu)
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
