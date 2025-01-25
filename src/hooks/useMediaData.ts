import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

export const useMediaData = () => {
  return useQuery({
    queryKey: ['telegram-media'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as MediaItem[];
    }
  });
};