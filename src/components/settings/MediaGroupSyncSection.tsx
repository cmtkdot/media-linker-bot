import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

export const MediaGroupSyncSection = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-media-groups');

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });

      toast({
        title: "Media Groups Sync Complete",
        description: `Updated ${data.updated_groups} groups and synced ${data.synced_media} media items`,
      });
    } catch (error: any) {
      console.error('Error in media groups sync:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync media groups",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Media Groups Sync</CardTitle>
        <CardDescription>
          Sync media groups with telegram media data and update analyzed content across groups
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSync}
          disabled={isSyncing}
          className="w-full"
          size="lg"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing Media Groups...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Media Groups
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};