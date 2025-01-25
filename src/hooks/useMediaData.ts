import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

export function useMediaData() {
  return useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item): MediaItem => ({
        id: item.id,
        message_id: item.message_id,
        file_id: item.file_id,
        file_unique_id: item.file_unique_id,
        file_type: item.file_type,
        public_url: item.public_url,
        default_public_url: item.default_public_url,
        caption: item.caption,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity: item.quantity,
        vendor_uid: item.vendor_uid,
        purchase_date: item.purchase_date,
        notes: item.notes,
        analyzed_content: item.analyzed_content,
        message_url: item.message_url,
        telegram_media_row_id: item.telegram_media_row_id,
        glide_app_url: item.glide_app_url,
        media_group_id: item.media_group_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        telegram_data: item.telegram_data,
        glide_data: item.glide_data,
        media_metadata: item.media_metadata,
        message_media_data: item.message_media_data
      }));
    }
  });
}