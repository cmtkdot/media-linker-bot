import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

export const CaptionSyncSection = () => {
  const [isSyncingCaptions, setIsSyncingCaptions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSyncCaptions = async () => {
    setIsSyncingCaptions(true);
    try {
      const { data: mediaGroups, error: fetchError } = await supabase
        .from('telegram_media')
        .select('telegram_data->media_group_id')
        .not('telegram_data->media_group_id', 'is', null);

      if (fetchError) throw fetchError;

      const uniqueGroups = (mediaGroups || []).reduce<{ media_group_id: string | null }[]>((acc, current) => {
        const mediaGroupId = current.media_group_id;
        if (mediaGroupId && !acc.some(g => g.media_group_id === mediaGroupId)) {
          acc.push({ media_group_id: mediaGroupId });
        }
        return acc;
      }, []);

      let syncedGroups = 0;
      for (const group of uniqueGroups) {
        const mediaGroupId = group.media_group_id;
        if (!mediaGroupId) continue;

        // Update all media in the group with the latest caption and analyzed content
        const { data: latestMedia } = await supabase
          .from('telegram_media')
          .select('*')
          .eq('telegram_data->>media_group_id', mediaGroupId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestMedia) {
          const { error: syncError } = await supabase
            .from('telegram_media')
            .update({
              caption: latestMedia.caption,
              analyzed_content: latestMedia.analyzed_content,
              product_name: latestMedia.product_name,
              product_code: latestMedia.product_code,
              quantity: latestMedia.quantity,
              vendor_uid: latestMedia.vendor_uid,
              purchase_date: latestMedia.purchase_date,
              notes: latestMedia.notes
            })
            .eq('telegram_data->>media_group_id', mediaGroupId);

          if (syncError) {
            console.error(`Error syncing group ${mediaGroupId}:`, syncError);
            continue;
          }
          syncedGroups++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });

      toast({
        title: "Caption Sync Complete",
        description: `Successfully synced captions for ${syncedGroups} media groups`,
      });
    } catch (error: any) {
      console.error('Error in caption sync:', error);
      toast({
        title: "Caption Sync Failed",
        description: error.message || "Failed to sync captions",
        variant: "destructive",
      });
    } finally {
      setIsSyncingCaptions(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Caption Sync</CardTitle>
        <CardDescription>
          Manually sync captions across media groups to ensure consistency
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSyncCaptions}
          disabled={isSyncingCaptions}
          className="w-full"
          size="lg"
        >
          {isSyncingCaptions ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing Captions...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Media Group Captions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};