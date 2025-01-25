import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { MediaItem } from "@/types/media";
import { convertToMediaItem } from "@/services/database-service";

export const useMediaActions = (refetch: () => Promise<void>) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const { error } = await supabase.functions.invoke('sync-media-groups');
      if (error) throw error;

      toast({
        title: "Media groups synced",
        description: "All media groups have been successfully synced.",
      });

      await refetch();
    } catch (error) {
      console.error('Error syncing media groups:', error);
      toast({
        title: "Sync failed",
        description: "Failed to sync media groups. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAnalyzeCaptions = async () => {
    try {
      setIsAnalyzing(true);
      const { data: mediaItems, error: fetchError } = await supabase
        .from('telegram_media')
        .select('*')
        .is('analyzed_content', null);

      if (fetchError) throw fetchError;

      const items = mediaItems.map(convertToMediaItem);
      const itemsWithCaptions = items.filter(item => 
        item.message_media_data?.message?.caption
      );

      if (itemsWithCaptions.length === 0) {
        toast({
          title: "No captions to analyze",
          description: "All media items with captions have already been analyzed.",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('analyze-caption', {
        body: { items: itemsWithCaptions }
      });

      if (error) throw error;

      toast({
        title: "Captions analyzed",
        description: `Successfully analyzed ${itemsWithCaptions.length} captions.`,
      });

      await refetch();
    } catch (error) {
      console.error('Error analyzing captions:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze captions. Please try again.",
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