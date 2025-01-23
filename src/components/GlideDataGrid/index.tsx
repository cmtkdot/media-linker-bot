import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import type { FailedWebhookUpdate, GlideConfig } from "@/types/glide";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: failedUpdates, isLoading } = useQuery({
    queryKey: ['failed-webhook-updates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('failed_webhook_updates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        onDelete: handleDelete
      })) as FailedWebhookUpdate[];
    }
  });

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('failed-webhook-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'failed_webhook_updates'
        },
        () => {
          // Refetch data when changes occur
          queryClient.invalidateQueries({ queryKey: ['failed-webhook-updates'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('failed_webhook_updates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Record deleted",
        description: "The failed update record has been removed.",
      });

      // Remove from selected rows if it was selected
      setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: "Error",
        description: "Failed to delete the record.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = async (recordIds?: string[]) => {
    if (!configs[0]?.id) {
      toast({
        title: "No configuration found",
        description: "Please set up a Glide configuration first",
        variant: "destructive",
      });
      return;
    }

    setIsRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-glide-media-table', {
        body: { 
          operation: 'retryFailed', 
          recordIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Retry Completed",
        description: `Successfully retried ${data.retried} records`,
      });

      if (data.errors?.length > 0) {
        console.error('Retry errors:', data.errors);
        toast({
          title: "Retry Completed with Errors",
          description: "Check console for details",
          variant: "destructive",
        });
      }

      // Clear selected rows after successful retry
      setSelectedRows([]);
    } catch (error) {
      console.error('Retry error:', error);
      toast({
        title: "Retry Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => handleRetry(selectedRows)}
          disabled={isRetrying || selectedRows.length === 0}
        >
          {isRetrying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retrying Selected...
            </>
          ) : (
            `Retry Selected (${selectedRows.length})`
          )}
        </Button>
        <Button
          onClick={() => handleRetry()}
          disabled={isRetrying || !failedUpdates?.length}
        >
          {isRetrying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retrying All...
            </>
          ) : (
            'Retry All'
          )}
        </Button>
      </div>
      <div className="rounded-md border">
        <DataTable 
          columns={columns} 
          data={failedUpdates || []} 
          onRowSelectionChange={setSelectedRows}
        />
      </div>
    </div>
  );
}