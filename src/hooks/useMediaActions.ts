import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SyncResponse {
  updated_groups: number;
  synced_media: number;
}

export const useMediaActions = (refetch: () => Promise<unknown>) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke<SyncResponse>('sync-media-groups');

      if (error) throw error;

      await refetch();

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

  const handleAnalyzeCaptions = async () => {
    setIsAnalyzing(true);
    try {
      const { data: unanalyzedMedia, error: mediaError } = await supabase
        .from('telegram_media')
        .select('*')
        .is('analyzed_content', null)
        .not('message_media_data->message->caption', 'is', null)
        .limit(100);

      if (mediaError) throw mediaError;

      if (!unanalyzedMedia?.length) {
        toast({
          title: "No Unanalyzed Captions",
          description: "All media items with captions have been analyzed.",
        });
        return;
      }

      let analyzedCount = 0;
      let errorCount = 0;

      for (const media of unanalyzedMedia) {
        try {
          const caption = media.message_media_data?.message?.caption;
          
          const { error: analysisError } = await supabase.functions.invoke('analyze-caption', {
            body: { 
              caption,
              messageId: media.id
            }
          });

          if (analysisError) {
            console.error('Error analyzing caption:', analysisError);
            errorCount++;
            continue;
          }

          analyzedCount++;
        } catch (error) {
          console.error('Error analyzing caption:', error);
          errorCount++;
        }
      }

      await refetch();

      toast({
        title: "Caption Analysis Complete",
        description: `Analyzed ${analyzedCount} captions with ${errorCount} errors.`,
      });
    } catch (error: any) {
      console.error('Error analyzing captions:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze captions",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    isSyncing,
    isAnalyzing,
    handleSync,
    handleAnalyzeCaptions
  };
};