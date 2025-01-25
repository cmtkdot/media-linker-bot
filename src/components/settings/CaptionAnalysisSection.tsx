import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain } from "lucide-react";

export function CaptionAnalysisSection() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      
      const { error } = await supabase.functions.invoke('analyze-media-group-caption');

      if (error) throw error;

      toast({
        title: "Captions analyzed",
        description: "Successfully analyzed media group captions.",
      });
    } catch (error) {
      console.error('Error analyzing captions:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze captions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Caption Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Analyze unprocessed media group captions using AI
          </p>
        </div>
        <Button 
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          variant="outline"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Analyze Captions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}