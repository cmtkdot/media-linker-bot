import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
        caption: item.caption,
        analyzed_content: item.analyzed_content,
        message_url: item.message_url,
        telegram_media_row_id: item.telegram_media_row_id,
        glide_app_url: item.glide_app_url,
        media_group_id: item.media_group_id,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    }
  });
}