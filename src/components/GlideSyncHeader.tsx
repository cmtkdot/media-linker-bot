import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GlideConfig {
  id: string;
  table_name: string;
  active: boolean;
  supabase_table_name: string;
}

interface GlideSyncHeaderProps {
  configs: GlideConfig[];
  isLoading: boolean;
}

export function GlideSyncHeader({ configs, isLoading }: GlideSyncHeaderProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingMissing, setIsCheckingMissing] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const { toast } = useToast();

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

  const handleCheckMissing = async () => {
    setIsCheckingMissing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-missing-rows-to-glide');

      if (error) throw error;

      toast({
        title: "Check Completed",
        description: data.message,
      });
    } catch (error) {
      console.error('Check missing rows error:', error);
      toast({
        title: "Check Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingMissing(false);
    }
  };

  const activeConfigs = configs?.filter(config => config.active) || [];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="/lovable-uploads/7770cb52-31d2-40b0-8b5b-0822783c71ef.png" 
            alt="App Logo" 
            className="h-8 w-8 object-contain"
          />
          <h1 className="text-2xl font-semibold">Glide Sync Settings</h1>
        </div>
        <Button variant="outline" asChild>
          <Link to="/glide-connections">Manage Connections</Link>
        </Button>
      </div>
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
        <Button
          onClick={handleCheckMissing}
          className="flex items-center gap-2"
          disabled={isCheckingMissing}
          variant="outline"
        >
          {isCheckingMissing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Missing Records'
          )}
        </Button>
      </div>
    </div>
  );
}