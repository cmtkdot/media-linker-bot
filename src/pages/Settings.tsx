import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

const Settings = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingCaptions, setIsSyncingCaptions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: thumbnailStats, refetch: refetchThumbnails } = useQuery({
    queryKey: ['thumbnailStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('count_missing_thumbnails');
      
      if (error) throw error;
      return data[0];
    }
  });

  const handleGenerateThumbnails = async () => {
    setIsGenerating(true);
    try {
      console.log('Starting thumbnail generation...');
      
      const { error: genError } = await supabase.rpc('generate_missing_thumbnails');
      if (genError) {
        console.error('Error generating thumbnails:', genError);
        throw genError;
      }

      // Wait a moment for the operation to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh the stats
      await refetchThumbnails();
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      console.log('Thumbnail generation completed');
      
      toast({
        title: "Success",
        description: "Thumbnails have been generated successfully. Please refresh the page to see the updates.",
      });
    } catch (error: any) {
      console.error('Error in handleGenerateThumbnails:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate thumbnails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSyncWithGlide = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-missing-rows-to-glide');
      
      if (error) throw error;

      toast({
        title: "Sync Completed",
        description: `Found ${data.differences_found} records to sync`,
      });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
    } catch (error: any) {
      console.error('Error syncing with Glide:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync with Glide",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncCaptions = async () => {
    setIsSyncingCaptions(true);
    try {
      const { data: mediaGroups, error: fetchError } = await supabase
        .from('telegram_media')
        .select('telegram_data->media_group_id')
        .not('telegram_data->media_group_id', 'is', null)
        .distinct();

      if (fetchError) throw fetchError;

      let syncedGroups = 0;
      for (const group of mediaGroups || []) {
        const mediaGroupId = group.media_group_id;
        if (!mediaGroupId) continue;

        const { error: syncError } = await supabase
          .rpc('sync_media_group_captions', { media_group_id: mediaGroupId });

        if (syncError) {
          console.error(`Error syncing group ${mediaGroupId}:`, syncError);
          continue;
        }
        syncedGroups++;
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
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="grid gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Video Thumbnails</CardTitle>
            <CardDescription>
              Generate missing thumbnails for video files in your media library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium">Current Status:</p>
                  <p className="text-sm text-muted-foreground">
                    Total videos: {thumbnailStats?.total_videos || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Missing thumbnails: {thumbnailStats?.missing_thumbnails || 0}
                  </p>
                </div>
                <Button 
                  onClick={handleGenerateThumbnails}
                  disabled={isGenerating || !thumbnailStats?.missing_thumbnails}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Thumbnails...
                    </>
                  ) : (
                    'Generate Missing Thumbnails'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Glide Sync</CardTitle>
            <CardDescription>
              Check for differences between Supabase and Glide data and sync if necessary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleSyncWithGlide}
              disabled={isSyncing}
              className="w-full"
              size="lg"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing with Glide...
                </>
              ) : (
                'Sync Missing Records with Glide'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;