import { useQuery } from "@tanstack/react-query";
import { MediaItem } from "@/types/media";
import { getMediaItems } from "@/services/database-service";

export const useMediaData = () => {
  return useQuery({
    queryKey: ['telegram-media'],
    queryFn: getMediaItems
  });
};