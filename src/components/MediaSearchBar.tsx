import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grid, List, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MediaSearchBarProps {
  search: string;
  view: 'grid' | 'table';
  onSearchChange: (value: string) => void;
  onViewChange: (view: 'grid' | 'table') => void;
}

const MediaSearchBar = ({ search, view, onSearchChange, onViewChange }: MediaSearchBarProps) => {
  const { toast } = useToast();

  const handleAnalyzeCaption = async () => {
    try {
      const { data: mediaItems, error: fetchError } = await supabase
        .from('telegram_media')
        .select('*')
        .is('analyzed_content', null);

      if (fetchError) throw fetchError;

      if (!mediaItems?.length) {
        toast({
          title: "No items to analyze",
          description: "All media items have already been analyzed.",
        });
        return;
      }

      toast({
        title: "Analysis started",
        description: `Analyzing ${mediaItems.length} media items...`,
      });

      for (const item of mediaItems) {
        if (!item.caption) continue;

        const { error } = await supabase.functions.invoke('analyze-caption', {
          body: {
            caption: item.caption,
            messageId: item.id,
            mediaGroupId: typeof item.telegram_data === 'object' ? (item.telegram_data as Record<string, any>).media_group_id : undefined,
            telegramData: item.telegram_data
          }
        });

        if (error) {
          console.error('Error analyzing caption:', error);
          toast({
            title: "Error",
            description: `Failed to analyze caption for item ${item.id}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Analysis complete",
        description: "All captions have been analyzed and updated.",
      });
    } catch (error) {
      console.error('Error in handleAnalyzeCaption:', error);
      toast({
        title: "Error",
        description: "Failed to analyze captions",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex justify-between items-center">
      <Input
        className="max-w-sm"
        placeholder="Search by caption, product name, code, or vendor..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleAnalyzeCaption}
          title="Analyze unprocessed captions"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
        <Button
          variant={view === 'grid' ? "default" : "outline"}
          size="icon"
          onClick={() => onViewChange('grid')}
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant={view === 'table' ? "default" : "outline"}
          size="icon"
          onClick={() => onViewChange('table')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MediaSearchBar;