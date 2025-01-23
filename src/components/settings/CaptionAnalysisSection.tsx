import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain } from "lucide-react";

export const CaptionAnalysisSection = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: analysisStats, refetch: refetchStats } = useQuery({
    queryKey: ['captionAnalysisStats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('telegram_media')
        .select('id', { count: 'exact', head: true })
        .is('analyzed_content', null);
      
      if (error) throw error;
      return {
        pending_analysis: count || 0
      };
    }
  });

  const handleAnalyzeCaptions = async () => {
    setIsAnalyzing(true);
    try {
      console.log('Starting caption analysis...');
      
      // First analyze messages with captions but no analysis
      const { data: messages, error: fetchError } = await supabase
        .from('telegram_media')
        .select('id, caption, telegram_data')
        .is('analyzed_content', null)
        .not('caption', 'is', null);

      if (fetchError) throw fetchError;

      for (const message of messages || []) {
        if (!message.caption) continue;

        try {
          // Call the analyze-caption function
          const { data: analysis, error: analysisError } = await supabase.functions.invoke('analyze-caption', {
            body: { 
              caption: message.caption,
              messageId: message.id,
              mediaGroupId: message.telegram_data?.media_group_id
            }
          });

          if (analysisError) throw analysisError;

        } catch (error) {
          console.error('Error analyzing caption:', error);
          // Continue with next message even if one fails
        }
      }

      await refetchStats();
      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      toast({
        title: "Analysis Complete",
        description: "Captions have been analyzed and data has been updated.",
      });
    } catch (error: any) {
      console.error('Error in caption analysis:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to analyze captions. Please try again.",
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
          Analyze captions to extract product information and update media groups
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">Current Status:</p>
              <p className="text-sm text-muted-foreground">
                Pending analysis: {analysisStats?.pending_analysis || 0} items
              </p>
            </div>
            <Button 
              onClick={handleAnalyzeCaptions}
              disabled={isAnalyzing || !analysisStats?.pending_analysis}
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
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze Pending Captions
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};