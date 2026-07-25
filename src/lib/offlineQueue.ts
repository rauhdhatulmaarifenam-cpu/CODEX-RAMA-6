import { get, set } from 'idb-keyval';
import { supabase } from './supabaseClient';
import type { OfflineQueueItem } from '../types';

const QUEUE_KEY = 'codex_offline_queue';

async function getQueue(): Promise<OfflineQueueItem[]> {
  const q = await get(QUEUE_KEY);
  return (q as OfflineQueueItem[]) || [];
}

async function saveQueue(queue: OfflineQueueItem[]) {
  await set(QUEUE_KEY, queue);
}

export async function addToQueue(item: Omit<OfflineQueueItem, 'localId' | 'createdAt' | 'status'>): Promise<void> {
  const queue = await getQueue();
  queue.push({
    localId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...item,
  });
  await saveQueue(queue);
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
}

export async function getPendingQueue(): Promise<OfflineQueueItem[]> {
  const queue = await getQueue();
  return queue.filter(q => q.status === 'pending' || q.status === 'failed');
}

export async function removeFromQueue(localId: string) {
  const queue = await getQueue();
  const filtered = queue.filter(q => q.localId !== localId);
  await saveQueue(filtered);
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
}

export async function updateQueueItem(localId: string, updates: Partial<OfflineQueueItem>) {
  const queue = await getQueue();
  const idx = queue.findIndex(q => q.localId === localId);
  if (idx >= 0) {
    queue[idx] = { ...queue[idx], ...updates };
    await saveQueue(queue);
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  }
}

export type MutateParams = {
  table: OfflineQueueItem['table'];
  operation: OfflineQueueItem['operation'];
  payload: any;
  id?: string; // for update/delete
};

export async function mutateWithQueue(params: MutateParams): Promise<{ data: any; error: any; queued: boolean }> {
  const { table, operation, payload, id } = params;

  // Ensure client-side UUID for inserts
  let finalPayload = payload;
  let finalId = id;
  if (operation === 'insert' && !payload.id) {
    finalPayload = { ...payload, id: crypto.randomUUID() };
    finalId = finalPayload.id;
  }

  const isOnline = navigator.onLine;

  if (!isOnline) {
    await addToQueue({ table, operation, payload: finalPayload });
    return { data: finalPayload, error: null, queued: true };
  }

  // Try direct operation
  try {
    let result;
    if (operation === 'insert') {
      result = await supabase.from(table).insert(finalPayload).select().single();
    } else if (operation === 'update') {
      if (!finalId) throw new Error('ID required for update');
      result = await supabase.from(table).update(finalPayload).eq('id', finalId).select().single();
    } else {
      if (!finalId) throw new Error('ID required for delete');
      result = await supabase.from(table).delete().eq('id', finalId).select().single();
    }

    if (result.error) {
      // If network error, queue it
      if (isNetworkError(result.error)) {
        await addToQueue({ table, operation, payload: operation !== 'delete' ? finalPayload : { id: finalId } });
        return { data: finalPayload, error: null, queued: true };
      }
      return { data: null, error: result.error, queued: false };
    }
    return { data: result.data, error: null, queued: false };
  } catch (e: any) {
    if (isNetworkError(e)) {
      await addToQueue({ table, operation, payload: finalPayload });
      return { data: finalPayload, error: null, queued: true };
    }
    return { data: null, error: e, queued: false };
  }
}

function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (!navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const msg = error.message?.toLowerCase() || '';
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_network_changed')
  );
}

export async function processQueue(onProgress?: (item: OfflineQueueItem, success: boolean) => void): Promise<{ success: number; failed: number }> {
  const queue = await getQueue();
  const pending = queue.filter(q => q.status === 'pending' || q.status === 'failed').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  let success = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      let result;
      const payload = item.payload;
      const id = payload.id || payload.ID;

      if (item.operation === 'insert') {
        // Check if record already exists? Try insert
        result = await supabase.from(item.table).insert(payload).select().single();
      } else if (item.operation === 'update') {
        const targetId = id || item.payload.id;
        if (!targetId) throw new Error('Missing ID for update');
        const { id: _id, ...updateData } = payload;
        result = await supabase.from(item.table).update(updateData).eq('id', targetId).select().single();
      } else {
        const targetId = payload.id || id;
        if (!targetId) throw new Error('Missing ID for delete');
        result = await supabase.from(item.table).delete().eq('id', targetId);
      }

      if (result?.error) {
        // If record already exists for insert, try update instead? But spec says last-write-wins, skip? Actually keep as failed for user decision if not network
        if (isNetworkError(result.error)) {
          await updateQueueItem(item.localId, { status: 'failed', error: result.error.message });
          failed++;
          onProgress?.(item, false);
          continue; // network still issues, stop processing?
        } else {
          // Real conflict error, don't auto-delete, mark failed
          await updateQueueItem(item.localId, { status: 'failed', error: result.error.message });
          failed++;
          onProgress?.(item, false);
          continue;
        }
      }

      // Success
      await removeFromQueue(item.localId);
      success++;
      onProgress?.(item, true);
    } catch (e: any) {
      if (isNetworkError(e)) {
        await updateQueueItem(item.localId, { status: 'failed', error: e.message || 'Network error' });
        failed++;
        onProgress?.(item, false);
        break; // stop processing further if network still down
      } else {
        await updateQueueItem(item.localId, { status: 'failed', error: e.message });
        failed++;
        onProgress?.(item, false);
      }
    }
  }

  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  return { success, failed };
}

export function setupOfflineListeners(processFn: () => void) {
  window.addEventListener('online', () => {
    console.log('[Offline] Back online, processing queue...');
    processFn();
  });

  // Polling fallback every 30s
  setInterval(() => {
    if (navigator.onLine) {
      getPendingQueue().then(q => {
        if (q.length > 0) processFn();
      });
    }
  }, 30000);
}
