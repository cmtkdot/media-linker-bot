import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

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
      const { error } = await supabase.rpc('generate_missing_thumbnails');
      
      if (error) throw error;
      
      await refetch();
      
      toast({
        title: "Success",
        description: "Thumbnails have been generated successfully",
      });
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      toast({
        title: "Error",
        description: "Failed to generate thumbnails",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
      </div>
    </div>
  );
};

export default Settings;