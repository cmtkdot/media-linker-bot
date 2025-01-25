import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
import { convertToMediaItem } from "./database-service";

export const searchTelegramMedia = async (searchTerm: string): Promise<MediaItem[]> => {
  const { data, error } = await supabase
    .rpc('search_telegram_media', { search_term: searchTerm });

  if (error) throw error;
  
  return (data || []).map(convertToMediaItem);
};