import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const GlideSyncSection = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSyncWithGlide = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-missing-rows-to-glide');
      
      if (error) throw error;

      toast({
        title: "Sync Completed",
        description: `Found ${data.differences_found} records to sync`,
      });

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
  );
};