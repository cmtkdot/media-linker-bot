import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GlideConfig } from "@/types/glide";
import { Link } from "react-router-dom";

interface GlideSyncHeaderProps {
  configs: GlideConfig[];
  isLoading: boolean;
}

interface SyncResponse {
  success: boolean;
  data?: {
    added: number;
    updated: number;
    deleted: number;
    errors: string[];
  };
  error?: string;
}

export function GlideSyncHeader({ configs, isLoading }: GlideSyncHeaderProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
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
      const { data, error } = await supabase.functions.invoke<SyncResponse>('sync-glide-media-table', {
        body: { 
          operation: 'syncBidirectional', 
          tableId: configs[0].id 
        }
      });

      if (error) throw error;

      if (!data?.data) {
        throw new Error('Invalid response from sync function');
      }

      const { added, updated, deleted, errors } = data.data;
      
      // Show success toast with processed items count
      toast({
        title: "Sync Completed",
        description: `Added: ${added}, Updated: ${updated}, Deleted: ${deleted}`,
      });

      // If there were any errors during sync, show them
      if (errors?.length > 0) {
        console.error('Sync errors:', errors);
        toast({
          title: "Sync Completed with Errors",
          description: "Check console for details",
          variant: "destructive",
        });
      }

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
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Glide Telegram Media Sync</h2>
        <p className="text-muted-foreground">
          Sync Telegram media files and metadata between Supabase and Glide
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSync}
          disabled={isSyncing || isLoading || !configs.length}
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            'Sync Now'
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/glide-connections">Configure Tables</Link>
        </Button>
      </div>
    </div>
  );
}