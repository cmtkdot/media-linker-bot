import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
import { databaseService } from "@/services/database-service";

export const useMediaData = () => {
  return useQuery({
    queryKey: ['telegram-media'],
    queryFn: async () => {
      return await databaseService.getMediaItems();
    }
  });
};