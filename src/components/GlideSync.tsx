import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GlideConfig {
  id: string;
  app_id: string;
  table_id: string;
  table_name: string;
  api_token: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}

const GlideSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const { toast } = useToast();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['glide-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_config')
        .select('*')
        .order('table_name');
      
      if (error) throw error;
      return data as GlideConfig[];
    }
  });

  const handleSync = async () => {
    if (!selectedTableId) {
      toast({
        title: "No table selected",
        description: "Please select a table to sync",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-glide-media-table', {
        body: { operation: 'syncBidirectional', tableId: selectedTableId }
      });

      if (error) throw error;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const activeConfigs = configs?.filter(config => config.active) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Glide Sync Settings</h1>
        <div className="flex items-center gap-4">
          <Select value={selectedTableId} onValueChange={setSelectedTableId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {activeConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.table_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleSync} 
            className="flex items-center gap-2"
            disabled={!selectedTableId || isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              'Sync with Glide'
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border bg-card">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Connected Glide Tables</h2>
            <div className="grid gap-4">
              {configs?.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-background"
                >
                  <div>
                    <h3 className="font-medium">{config.table_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Table ID: {config.table_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
                      config.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {config.active ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Inactive
                        </>
                      )}
                    </span>
                    <div className="text-sm text-muted-foreground">
                      Last updated: {new Date(config.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlideSync;