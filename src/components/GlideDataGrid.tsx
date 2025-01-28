import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { useToast } from "@/components/ui/use-toast";
import type { GlideSyncQueueItem, GlideConfig } from "@/types/glide";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const { toast } = useToast();
  
  const { data: syncQueue, isLoading } = useQuery({
    queryKey: ['glide-sync-queue'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('glide_sync_queue')
          .select('*')
          .is('processed_at', null)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return (data || []) as GlideSyncQueueItem[];
      } catch (error) {
        console.error('Error fetching sync queue:', error);
        toast({
          title: "Error fetching queue",
          description: "Failed to load sync queue items.",
          variant: "destructive",
        });
        return [];
      }
    }
  });

  return (
    <div className="rounded-md border">
      <DataTable columns={columns} data={syncQueue || []} />
    </div>
  );
}