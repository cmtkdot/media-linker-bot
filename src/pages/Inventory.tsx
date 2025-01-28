import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";
import { InventorySliderGrid } from "@/components/inventory/InventorySliderGrid";
import { MediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

const InventoryPage = () => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const { toast } = useToast();

  const { data, refetch, error } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching inventory:", error);
        toast({
          title: "Error loading inventory",
          description: "Failed to load inventory items. Please try again.",
          variant: "destructive",
        });
        throw error;
      }

      return data.map((item: any): MediaItem => {
        const messageData = item.telegram_data || {};
        return {
          ...item,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: item.telegram_data as Record<string, any>,
          glide_data: item.glide_data as Record<string, any>,
          media_metadata: item.media_metadata as Record<string, any>,
          message_media_data: item.message_media_data as Record<string, any>,
          analyzed_content: item.analyzed_content as Record<string, any>,
        };
      });
    }
  });

  useEffect(() => {
    if (data) {
      setItems(data);
    }
  }, [data]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8">Inventory</h1>
      {error && (
        <div className="text-red-500 mb-4">
          Error loading inventory. Please try again.
        </div>
      )}
      <InventorySliderGrid initialItems={items} />
    </div>
  );
};

export default InventoryPage;