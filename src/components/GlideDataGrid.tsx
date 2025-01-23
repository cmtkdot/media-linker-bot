import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import type { GlideSyncQueueItem, GlideConfig } from "@/types/glide";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const { data: syncQueue, isLoading } = useQuery({
    queryKey: ['glide-sync-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_sync_queue')
        .select('*')
        .is('processed_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GlideSyncQueueItem[];
    }
  });

  return (
    <div className="rounded-md border">
      <DataTable columns={columns} data={syncQueue || []} />
    </div>
  );
}