import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

export const MessageMediaSyncSection = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data: syncResults, error: syncError } = await supabase.rpc('sync_messages_to_telegram_media');
      
      if (syncError) {
        console.error('Error in sync_messages_to_telegram_media:', syncError);
        throw syncError;
      }

      const syncResult = syncResults?.[0] || { synced_count: 0, error_count: 0 };

      const { data, error } = await supabase.functions.invoke('sync-message-media', {
        body: { operation: 'syncAll' }
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });

      toast({
        title: "Message Media Sync Complete",
        description: `Processed ${data?.processed_count || 0} messages and synced ${data?.synced_media || 0} media items. ${syncResult.synced_count || 0} records synced from messages.`,
      });
    } catch (error: any) {
      console.error('Error in message media sync:', error);
      
      let errorMessage = error.message;
      try {
        if (error.body) {
          const bodyError = JSON.parse(error.body);
          errorMessage = bodyError.message || error.message;
        }
      } catch (e) {
        // If parsing fails, use the original error message
      }
      
      toast({
        title: "Sync Failed",
        description: errorMessage || "Failed to sync message media",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Message Media Sync</CardTitle>
        <CardDescription>
          Sync media from messages to telegram media table and process files
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
              Syncing Message Media...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Message Media
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};