import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { GlideSyncQueueItem, GlideConfig } from "@/types/glide";
import type { Database } from "@/integrations/supabase/types";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const { data: syncQueue, isLoading, refetch } = useQuery({
    queryKey: ['glide-sync-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_sync_queue')
        .select('*')
        .is('processed_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Cast the data to the correct type
      return (data || []) as GlideSyncQueueItem[];
    }
  });

  const handleSync = async (recordIds?: string[]) => {
    if (!configs[0]?.id) {
      toast({
        title: "No configuration found",
        description: "Please set up a Glide configuration first",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-glide-media-table', {
        body: { 
          operation: 'syncBidirectional', 
          tableId: configs[0].id,
          recordIds 
        }
      });

      if (error) {
        console.error('Sync error:', error);
        throw error;
      }

      toast({
        title: "Sync Completed",
        description: `Added: ${data.added}, Updated: ${data.updated}, Deleted: ${data.deleted}`,
      });

      if (data.errors?.length > 0) {
        console.error('Sync errors:', data.errors);
        toast({
          title: "Sync Completed with Errors",
          description: "Check console for details",
          variant: "destructive",
        });
      }

      // Refresh the queue after sync
      refetch();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => handleSync(selectedRows)}
          disabled={isSyncing || selectedRows.length === 0}
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing Selected...
            </>
          ) : (
            `Sync Selected (${selectedRows.length})`
          )}
        </Button>
        <Button
          onClick={() => handleSync()}
          disabled={isSyncing || !syncQueue?.length}
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing All...
            </>
          ) : (
            'Sync All'
          )}
        </Button>
      </div>
      <div className="rounded-md border">
        <DataTable 
          columns={columns} 
          data={syncQueue || []} 
          onRowSelectionChange={setSelectedRows}
        />
      </div>
    </div>
  );
}