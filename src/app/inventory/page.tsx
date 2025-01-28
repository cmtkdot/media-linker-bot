import { createSupabaseClient } from "@/lib/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";
import { InventorySliderGrid } from "@/components/inventory/InventorySliderGrid";
import { MediaItem } from "@/types/media";
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

      return data.map((item): MediaItem => ({
        ...item,
        file_type: item.file_type as MediaItem['file_type'],
        telegram_data: item.message_media_data?.telegram_data || {},
        glide_data: item.glide_data || {},
        media_metadata: item.message_media_data?.media || {},
        analyzed_content: item.message_media_data?.analysis?.analyzed_content || {},
        message_media_data: item.message_media_data || {
          message: {},
          sender: {},
          analysis: {},
          meta: {
            created_at: item.created_at,
            updated_at: item.updated_at,
            status: 'pending',
            error: null
          },
          media: {},
          telegram_data: {}
        }
      }));
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