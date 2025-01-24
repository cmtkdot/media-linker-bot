import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useMediaActions = (refetch: () => Promise<any>) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-media-groups');

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
        .is('product_name', null)
        .not('caption', 'is', null);

      if (mediaError) throw mediaError;

      if (!unanalyzedMedia?.length) {
        toast({
          title: "No Unanalyzed Captions",
          description: "All media items with captions have been analyzed and have product names extracted.",
        });
        return;
      }

      toast({
        title: "Starting Caption Analysis",
        description: `Found ${unanalyzedMedia.length} items that need analysis.`,
      });

      for (const item of unanalyzedMedia) {
        if (item.telegram_data && typeof item.telegram_data === 'object' && 'media_group_id' in item.telegram_data) {
          const mediaGroupId = item.telegram_data.media_group_id;
          
          if (mediaGroupId) {
            const { data: groupItems } = await supabase
              .from('telegram_media')
              .select('analyzed_content, product_name')
              .eq('telegram_data->media_group_id', mediaGroupId)
              .not('product_name', 'is', null)
              .limit(1);

            if (groupItems && groupItems.length > 0) {
              continue;
            }
          }
        }

        const { error: analysisError } = await supabase.functions.invoke('analyze-caption', {
          body: { 
            caption: item.caption,
            messageId: item.id
          }
        });

        if (analysisError) {
          console.error('Error analyzing caption:', analysisError);
          continue;
        }
      }

      await refetch();

      toast({
        title: "Caption Analysis Complete",
        description: `Analyzed ${unanalyzedMedia.length} captions. Check the table view to see the results.`,
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