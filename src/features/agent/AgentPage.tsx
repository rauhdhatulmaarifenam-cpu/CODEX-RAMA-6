import { Bot, Sparkles, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export function AgentPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md space-y-6"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
          <Bot className="w-10 h-10 text-primary" />
        </div>

        {/* Heading */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Segera Hadir</span>
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <h1 className="font-heading text-3xl font-bold">AI Agent</h1>
          <p className="mt-3 text-text-secondary leading-relaxed">
            Fitur AI Agent akan hadir di fase berikutnya. Agent akan dapat mengelola data santri,
            kelas, guru, dan seksi secara otomatis melalui perintah dalam bahasa natural.
          </p>
        </div>

        {/* Coming soon details */}
        <div className="p-4 rounded-2xl bg-background border border-border/60 text-left space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Clock className="w-4 h-4 text-primary" />
            Direncanakan pada Fase Berikutnya
          </div>
          <ul className="text-sm text-text-secondary space-y-1 pl-6 list-disc">
            <li>Tambah, ubah, dan hapus data via perintah teks</li>
            <li>Laporan otomatis sesuai kebutuhan pesantren</li>
            <li>Notifikasi cerdas berbasis anomali data</li>
            <li>Sinkronisasi dan rekonsiliasi data multi-sumber</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
