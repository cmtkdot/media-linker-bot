import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";
import { TelegramMessageData } from "@/types/media";

export const CaptionAnalysisSection = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      // Get unanalyzed media
      const { data: unanalyzedMedia, error: mediaError } = await supabase
        .from('telegram_media')
        .select('*')
        .is('analyzed_content', null)
        .not('telegram_data->message_data->caption', 'is', null)
        .limit(100);

      if (mediaError) throw mediaError;

      let analyzedCount = 0;
      let errorCount = 0;

      // Process each media item
      for (const media of (unanalyzedMedia || [])) {
        try {
          const telegramData = media.telegram_data as TelegramMessageData;
          const caption = telegramData?.message_data?.caption;

          const { data: analyzedContent, error: analysisError } = await supabase.functions.invoke('analyze-caption', {
            body: { 
              caption,
              messageId: media.id
            }
          });

          if (analysisError) throw analysisError;

          if (analyzedContent) {
            analyzedCount++;
          }
        } catch (error) {
          console.error('Error analyzing caption:', error);
          errorCount++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });

      toast({
        title: "Caption Analysis Complete",
        description: `Analyzed ${analyzedCount} captions with ${errorCount} errors.`,
      });
    } catch (error: any) {
      console.error('Error in caption analysis:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze captions",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Caption Analysis</CardTitle>
        <CardDescription>
          Analyze unprocessed media captions to extract product information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full"
          size="lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing Captions...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Analyze Captions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};