import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MediaItem } from "@/types/media";

export const useMediaActions = (onRefetch?: () => Promise<void>) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-media-groups');
      
      if (error) throw error;

      toast({
        title: "Media Groups Synced",
        description: `Successfully synced ${data?.synced_count || 0} media groups.`,
      });

      if (onRefetch) await onRefetch();
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error: any) {
      console.error('Error syncing media groups:', error);
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
      const { data: unanalyzedMedia } = await supabase
        .from('telegram_media')
        .select('*')
        .is('analyzed_content', null)
        .not('message_media_data', 'is', null);

      if (!unanalyzedMedia?.length) {
        toast({
          title: "No media to analyze",
          description: "All media items have already been analyzed.",
        });
        return;
      }

      let analyzedCount = 0;
      let errorCount = 0;

      for (const media of unanalyzedMedia) {
        const caption = media.message_media_data?.message?.caption;
        if (!caption) continue;

        try {
          const { data: analyzedContent, error: analysisError } = await supabase.functions.invoke('analyze-caption', {
            body: { 
              caption,
              messageId: media.id
            }
          });

          if (analysisError) throw analysisError;

          if (analyzedContent) {
            analyzedCount++;
          }
        } catch (error) {
          console.error('Error analyzing caption:', error);
          errorCount++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });

      toast({
        title: "Caption Analysis Complete",
        description: `Analyzed ${analyzedCount} captions with ${errorCount} errors.`,
      });
    } catch (error: any) {
      console.error('Error in caption analysis:', error);
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