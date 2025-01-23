import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const ThumbnailSection = () => {
  const [isGenerating, setIsGenerating] = useState(false);
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

      await new Promise(resolve => setTimeout(resolve, 2000));
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

  return (
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
  );
};