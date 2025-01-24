import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MessageMediaData, ThumbnailSource } from "@/types/media";

interface MediaQueryResult {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string | null;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  message_media_data: MessageMediaData;
  analyzed_content: Record<string, any> | null;
  thumbnail_state: string | null;
  thumbnail_source: string | null;
  thumbnail_url: string | null;
  thumbnail_error: string | null;
  default_public_url: string | null;
  caption: string | null;
  media_group_id: string | null;
  product_name: string | null;
  product_code: string | null;
  quantity: number | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  message_url: string | null;
  glide_app_url: string | null;
  created_at: string;
  updated_at: string;
  telegram_media_row_id: string | null;
}

const mapToMediaItem = (item: MediaQueryResult): MediaItem => ({
  id: item.id,
  file_id: item.file_id,
  file_unique_id: item.file_unique_id,
  file_type: item.file_type as MediaItem['file_type'],
  public_url: item.public_url,
  default_public_url: item.default_public_url,
  thumbnail_url: item.thumbnail_url,
  thumbnail_state: item.thumbnail_state as MediaItem['thumbnail_state'],
  thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource,
  thumbnail_error: item.thumbnail_error,
  caption: item.caption,
  media_group_id: item.media_group_id,
  telegram_data: item.telegram_data,
  glide_data: item.glide_data,
  media_metadata: item.media_metadata,
  message_media_data: item.message_media_data,
  vendor_uid: item.vendor_uid,
  purchase_date: item.purchase_date,
  notes: item.notes,
  analyzed_content: item.analyzed_content,
  message_url: item.message_url,
  glide_app_url: item.glide_app_url,
  created_at: item.created_at,
  updated_at: item.updated_at,
  telegram_media_row_id: item.telegram_media_row_id,
  product_name: item.product_name,
  product_code: item.product_code,
  quantity: item.quantity
});

export const useMediaData = (
  search: string,
  selectedChannel: string,
  selectedType: string,
  selectedVendor: string,
  selectedSort: string
) => {
  return useQuery({
    queryKey: ['telegram-media', search, selectedChannel, selectedType, selectedVendor, selectedSort],
    queryFn: async () => {
      if (search) {
        const { data: searchResults, error: searchError } = await supabase
          .rpc('search_telegram_media', { search_term: search });
        
        if (searchError) throw searchError;
        
        return (searchResults as unknown as MediaQueryResult[]).map(mapToMediaItem);
      }

      let query = supabase.from('telegram_media').select('*');

      if (selectedChannel !== "all") {
        query = query.eq('telegram_data->message_data->chat->title', selectedChannel);
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

      return (queryResult as unknown as MediaQueryResult[]).map(mapToMediaItem);
    }
  });
};