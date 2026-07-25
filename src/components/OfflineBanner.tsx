import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Clock, AlertCircle, X } from 'lucide-react';
import { getPendingQueue, processQueue } from '../lib/offlineQueue';
import type { OfflineQueueItem } from '../types';
import { Button } from './Button';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refreshQueue = async () => {
    const q = await getPendingQueue();
    setQueue(q);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = () => refreshQueue();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-updated', handleQueueUpdate as EventListener);

    refreshQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-updated', handleQueueUpdate as EventListener);
    };
  }, []);

  const handleSyncNow = async () => {
    setProcessing(true);
    await processQueue();
    await refreshQueue();
    setProcessing(false);
  };

  const showOfflineWarning = !isOnline;
  const showPending = queue.length > 0 && isOnline;
  const showFailed = queue.some(q => q.status === 'failed');

  if (dismissed && !showFailed) return null;
  if (!showOfflineWarning && !showPending && !showFailed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className={`sticky top-0 z-40 w-full px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium ${
          showOfflineWarning ? 'bg-amber-100 text-amber-900 border-b border-amber-200' : 
          showFailed ? 'bg-red-50 text-danger border-b border-red-200' :
          'bg-blue-50 text-blue-900 border-b border-blue-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {!isOnline ? <WifiOff className="w-4 h-4" /> : showFailed ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          <span>
            {!isOnline 
              ? `Sedang offline — ${queue.length} perubahan menunggu sinkronisasi`
              : showFailed
              ? `${queue.length} perubahan gagal tersinkron — cek detail di bawah`
              : `${queue.length} perubahan menunggu sinkronisasi`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && queue.length > 0 && (
            <Button size="sm" variant="secondary" loading={processing} onClick={handleSyncNow}>
              Sinkronisasi sekarang
            </Button>
          )}
          {!showFailed && (
            <button onClick={() => setDismissed(true)} className="p-1 rounded-lg hover:bg-black/5">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
