import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function ThumbnailSection() {
  const { data: thumbnailStats, isLoading } = useQuery({
    queryKey: ['thumbnailStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('count_missing_thumbnails');
      if (error) throw error;
      return data[0];
    }
  });

  const handleRegenerateThumbnails = async () => {
    try {
      const { data, error } = await supabase
        .rpc('regenerate_video_thumbnails');
      if (error) throw error;
      
      toast.success(`Successfully regenerated thumbnails`);
    } catch (error) {
      console.error('Error regenerating thumbnails:', error);
      toast.error('Failed to regenerate thumbnails');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Thumbnails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoading && thumbnailStats && (
          <div className="grid gap-4">
            <div>
              <p>Total Videos: {thumbnailStats.total_videos}</p>
              <p>Missing Thumbnails: {thumbnailStats.missing_thumbnails}</p>
            </div>
            <Button onClick={handleRegenerateThumbnails}>
              Regenerate Thumbnails
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}