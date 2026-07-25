import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useRealtime(table: string, queryKeys: string[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        queryKeys.forEach(k => {
          qc.invalidateQueries({ queryKey: k });
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, qc, JSON.stringify(queryKeys)]);
}
