import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { GlideSyncQueueItem, GlideConfig } from "@/types/glide";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncQueue, isLoading, refetch } = useQuery({
    queryKey: ['glide-sync-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_sync_queue')
        .select('*')
        .is('processed_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as GlideSyncQueueItem[];
    }
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('glide-sync-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'glide_sync_queue'
        },
        () => {
          // Refetch data when changes occur
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

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

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('glide_sync_queue')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Record Deleted",
        description: "The sync queue record has been removed",
      });

      // Refresh data
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRetrySync = async (id: string) => {
    try {
      const record = syncQueue?.find(item => item.id === id);
      if (!record) throw new Error("Record not found");

      await handleSync([record.record_id]);

      toast({
        title: "Sync Retry Initiated",
        description: "The record is being synced",
      });
    } catch (error) {
      console.error('Retry sync error:', error);
      toast({
        title: "Retry Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Enhanced columns with action buttons
  const enhancedColumns = [
    ...columns,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRetrySync(row.original.id)}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Retry Sync'
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

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
          columns={enhancedColumns} 
          data={syncQueue || []} 
          onRowSelectionChange={setSelectedRows}
        />
      </div>
    </div>
  );
}