import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";
import { InventorySliderGrid } from "@/components/inventory/InventorySliderGrid";
import { MediaItem, ThumbnailSource } from "@/types/media";
import { useQuery } from "@tanstack/react-query";

const supabase = createSupabaseClient;

const InventoryPage = () => {
  const [items, setItems] = useState<MediaItem[]>([]);

  const { data, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item: any): MediaItem => {
        const messageData = (item.telegram_data as Record<string, any>)?.message_data || {};
        return {
          ...item,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: item.telegram_data as Record<string, any>,
          glide_data: item.glide_data as Record<string, any>,
          media_metadata: item.media_metadata as Record<string, any>,
          message_media_data: item.message_media_data as Record<string, any>,
          analyzed_content: item.analyzed_content as Record<string, any>,
          thumbnail_state: (item.thumbnail_state || 'pending') as MediaItem['thumbnail_state'],
          thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource,
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
      <InventorySliderGrid initialItems={items} />
    </div>
  );
};

export default InventoryPage;