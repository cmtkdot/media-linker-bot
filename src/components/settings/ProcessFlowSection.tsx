import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, RefreshCw, ListChecks } from "lucide-react";

export const ProcessFlowSection = () => {
  const [isProcessingMessages, setIsProcessingMessages] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [isCheckingQueue, setIsCheckingQueue] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleProcessMessages = async () => {
    setIsProcessingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-missing-rows-to-glide', {
        body: { operation: 'processMessages' }
      });

      if (error) throw error;

      toast({
        title: "Message Processing Complete",
        description: `Processed ${data.processed_count || 0} messages`,
      });

      await queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error: any) {
      console.error('Error processing messages:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process messages",
        variant: "destructive",
      });
    } finally {
      setIsProcessingMessages(false);
    }
  };

  const handleProcessMedia = async () => {
    setIsProcessingMedia(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-missing-rows-to-glide', {
        body: { operation: 'processMedia' }
      });

      if (error) throw error;

      toast({
        title: "Media Processing Complete",
        description: `Processed ${data.processed_count || 0} media items`,
      });

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error: any) {
      console.error('Error processing media:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process media",
        variant: "destructive",
      });
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const handleCheckQueue = async () => {
    setIsCheckingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-glide-media-table', {
        body: { operation: 'processSyncQueue' }
      });

      if (error) throw error;

      toast({
        title: "Queue Processing Complete",
        description: `Processed ${data.processed_count || 0} items from queue`,
      });

      await queryClient.invalidateQueries({ queryKey: ['glide-sync-queue'] });
    } catch (error: any) {
      console.error('Error checking queue:', error);
      toast({
        title: "Queue Check Failed",
        description: error.message || "Failed to process queue",
        variant: "destructive",
      });
    } finally {
      setIsCheckingQueue(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Process Flow</CardTitle>
        <CardDescription>
          Follow these steps to process new messages and media
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <h3 className="font-semibold mb-2">Step 1: Process New Messages</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Check for new messages and create records in the messages table
            </p>
            <Button 
              onClick={handleProcessMessages}
              disabled={isProcessingMessages}
              className="w-full"
              size="lg"
            >
              {isProcessingMessages ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Messages...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Process New Messages
                </>
              )}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-muted">
            <h3 className="font-semibold mb-2">Step 2: Process Media Files</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Process media from messages and create records in telegram_media table
            </p>
            <Button 
              onClick={handleProcessMedia}
              disabled={isProcessingMedia}
              className="w-full"
              size="lg"
            >
              {isProcessingMedia ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Media...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Process Media Files
                </>
              )}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-muted">
            <h3 className="font-semibold mb-2">Step 3: Check Processing Queue</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Process any queued items that had errors or need retrying
            </p>
            <Button 
              onClick={handleCheckQueue}
              disabled={isCheckingQueue}
              className="w-full"
              size="lg"
            >
              {isCheckingQueue ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking Queue...
                </>
              ) : (
                <>
                  <ListChecks className="w-4 h-4 mr-2" />
                  Process Queue Items
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};