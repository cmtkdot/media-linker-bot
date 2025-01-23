import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

const Settings = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingSpecific, setIsRegeneratingSpecific] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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
      const { data, error } = await supabase.functions.invoke('regenerate-thumbnails');
      
      if (error) throw error;
      
      await refetchThumbnails();
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      toast({
        title: "Success",
        description: `Processed ${data.processed} videos. Please refresh the page to see the updates.`,
      });
    } catch (error: any) {
      console.error('Error in handleGenerateThumbnails:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate thumbnails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSpecificThumbnails = async () => {
    setIsRegeneratingSpecific(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-thumbnails', {
        body: { mode: 'specific' }
      });
      
      if (error) throw error;

      await refetchThumbnails();
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      toast({
        title: "Success",
        description: `Processed ${data.processed} specific videos. Please refresh to see updates.`,
      });
    } catch (error: any) {
      console.error('Error regenerating specific thumbnails:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate specific thumbnails.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingSpecific(false);
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
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate Missing Thumbnails
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleRegenerateSpecificThumbnails}
                  disabled={isRegeneratingSpecific}
                  className="w-full"
                  size="lg"
                  variant="secondary"
                >
                  {isRegeneratingSpecific ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating Specific Thumbnails...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate Identified Thumbnails
                    </>
                  )}
                </Button>
              </div>
            </div>
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