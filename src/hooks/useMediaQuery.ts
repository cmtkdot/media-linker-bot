import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MediaItem, QueryResult } from "@/types/media";

export const useMediaQuery = (
  search: string,
  selectedChannel: string,
  selectedType: string,
  selectedVendor: string,
  selectedSort: string
) => {
  return useQuery<MediaItem[]>({
    queryKey: ['telegram-media', search, selectedChannel, selectedType, selectedVendor, selectedSort],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*');

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      if (selectedChannel !== "all") {
        query = query.filter('telegram_data', 'cs', `{"chat":{"title":"${selectedChannel}"}}`);
      }

      if (selectedType !== "all") {
        query = query.eq('file_type', selectedType);
      }

      if (selectedVendor !== "all") {
        query = query.eq('vendor_uid', selectedVendor);
      }

      const [sortField, sortDirection] = selectedSort.split('_');
      switch (sortField) {
        case 'created':
          query = query.order('created_at', { ascending: sortDirection === 'asc' });
          break;
        case 'purchase':
          query = query.order('purchase_date', { ascending: sortDirection === 'asc' });
          break;
        case 'name':
          query = query.order('product_name', { ascending: sortDirection === 'asc' });
          break;
        case 'caption':
          query = query.order('caption', { ascending: sortDirection === 'asc' });
          break;
        case 'code':
          query = query.order('product_code', { ascending: sortDirection === 'asc' });
          break;
        case 'vendor':
          query = query.order('vendor_uid', { ascending: sortDirection === 'asc' });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data: queryResult, error: queryError } = await query;
      
      if (queryError) throw queryError;

      return (queryResult as QueryResult[]).map((item): MediaItem => {
        let thumbnailUrl = item.thumbnail_url;
        if (item.file_type === 'video' && !thumbnailUrl) {
          const videoThumb = item.telegram_data?.message_data?.video?.thumb;
          if (videoThumb?.file_unique_id) {
            const { data } = supabase
              .storage
              .from('media')
              .getPublicUrl(`${videoThumb.file_unique_id}.jpg`);
            thumbnailUrl = data?.publicUrl || null;
          }
        }

        const mediaMetadata = {
          ...item.media_metadata,
          dimensions: item.telegram_data?.message_data?.video || {},
          thumbnail: item.telegram_data?.message_data?.video?.thumb || {}
        };

        return {
          ...item,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: item.telegram_data || {},
          glide_data: item.glide_data || {},
          media_metadata: mediaMetadata,
          thumbnail_url: thumbnailUrl,
          analyzed_content: item.analyzed_content ? {
            text: item.analyzed_content.text || '',
            labels: item.analyzed_content.labels || [],
            objects: item.analyzed_content.objects || []
          } : undefined,
          created_at: item.created_at,
          updated_at: item.updated_at
        };
      });
    }
  });
};