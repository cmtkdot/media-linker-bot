import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, RefreshCw, ListChecks } from "lucide-react";

export const ProcessFlowSection = () => {
  const [isProcessingMessages, setIsProcessingMessages] = useState(false);
  const [isProcessingMediaGroups, setIsProcessingMediaGroups] = useState(false);
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

  const handleProcessMediaGroups = async () => {
    setIsProcessingMediaGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-media-groups', {
        body: { operation: 'processAll' }
      });

      if (error) throw error;

      toast({
        title: "Media Groups Processing Complete",
        description: `Processed ${data.processed || 0} groups with ${data.errors || 0} errors`,
      });

      await queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error: any) {
      console.error('Error processing media groups:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process media groups",
        variant: "destructive",
      });
    } finally {
      setIsProcessingMediaGroups(false);
    }
  };

  const handleCheckQueue = async () => {
    setIsCheckingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-media-queue', {
        body: { operation: 'processAll' }
      });

      if (error) throw error;

      toast({
        title: "Queue Processing Complete",
        description: `Processed ${data.processed || 0} items from queue`,
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
            <h3 className="font-semibold mb-2">Step 2: Process Media Groups</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Analyze captions and prepare media groups for processing
            </p>
            <Button 
              onClick={handleProcessMediaGroups}
              disabled={isProcessingMediaGroups}
              className="w-full"
              size="lg"
            >
              {isProcessingMediaGroups ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Media Groups...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Process Media Groups
                </>
              )}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-muted">
            <h3 className="font-semibold mb-2">Step 3: Process Queue Items</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Process media files and sync with storage
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
                  Processing Queue...
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