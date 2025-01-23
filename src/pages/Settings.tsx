import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: thumbnailStats, refetch } = useQuery({
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

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      console.log('Thumbnail generation completed');
      
      toast({
        title: "Success",
        description: "Thumbnails have been generated successfully",
      });
    } catch (error) {
      console.error('Error in handleGenerateThumbnails:', error);
      toast({
        title: "Error",
        description: "Failed to generate thumbnails. Please try again.",
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
      
    } catch (error) {
      console.error('Error syncing with Glide:', error);
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Video Thumbnails</CardTitle>
            <CardDescription>
              Generate missing thumbnails for video files in your media library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
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
                >
                  {isGenerating ? "Generating..." : "Generate Thumbnails"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Glide Sync</CardTitle>
            <CardDescription>
              Check for differences between Supabase and Glide data and sync if necessary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <Button 
                onClick={handleSyncWithGlide}
                disabled={isSyncing}
              >
                {isSyncing ? "Syncing..." : "Sync with Glide"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;