import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ThumbnailSection() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleProcessThumbnails = async () => {
    setIsProcessing(true);
    try {
      const { data: stats } = await supabase.rpc('count_missing_thumbnails');
      
      if (!stats) {
        throw new Error('Failed to get thumbnail statistics');
      }

      toast({
        title: "Thumbnail Status",
        description: `Total videos: ${stats.total_videos}, Missing thumbnails: ${stats.missing_thumbnails}`,
      });

      const { data: updates } = await supabase.rpc('regenerate_video_thumbnails');

      if (updates && updates.length > 0) {
        toast({
          title: "Thumbnails Updated",
          description: `Updated ${updates.length} video thumbnails`,
        });
      } else {
        toast({
          title: "No Updates Required",
          description: "All video thumbnails are up to date",
        });
      }
    } catch (error: any) {
      console.error('Error processing thumbnails:', error);
      toast({
        title: "Error Processing Thumbnails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Video Thumbnails</h3>
          <p className="text-sm text-muted-foreground">
            Generate and update video thumbnails
          </p>
        </div>
        <Button
          onClick={handleProcessThumbnails}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Process Thumbnails'
          )}
        </Button>
      </div>
    </div>
  );
}