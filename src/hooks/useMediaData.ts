import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MessageMediaData } from "@/types/media";
import { Database } from "@/integrations/supabase/types";

type TelegramMedia = Database['public']['Tables']['telegram_media']['Row'];

const mapToMediaItem = (item: TelegramMedia): MediaItem => {
  const messageMediaData: MessageMediaData = item.message_media_data || {
    message: {
      url: item.message_url || '',
      media_group_id: item.telegram_data?.media_group_id || '',
      caption: item.telegram_data?.message_data?.caption || '',
      message_id: item.telegram_data?.message_data?.message_id || 0,
      chat_id: item.telegram_data?.message_data?.chat?.id || 0,
      date: item.telegram_data?.message_data?.date || 0
    },
    sender: {
      sender_info: item.sender_info || {},
      chat_info: item.telegram_data?.message_data?.chat || {}
    },
    analysis: {
      analyzed_content: item.analyzed_content || {}
    },
    meta: {
      created_at: item.created_at,
      updated_at: item.updated_at,
      status: item.processing_error ? 'error' : item.processed ? 'processed' : 'pending',
      error: item.processing_error
    }
  };

  return {
    id: item.id,
    file_id: item.file_id,
    file_unique_id: item.file_unique_id,
    file_type: item.file_type as MediaItem['file_type'],
    public_url: item.public_url || undefined,
    default_public_url: item.default_public_url || undefined,
    thumbnail_url: item.thumbnail_url || undefined,
    thumbnail_state: (item.thumbnail_state || 'pending') as MediaItem['thumbnail_state'],
    thumbnail_source: (item.thumbnail_source || 'default') as MediaItem['thumbnail_source'],
    thumbnail_error: item.thumbnail_error || undefined,
    caption: item.telegram_data?.message_data?.caption,
    media_group_id: item.telegram_data?.media_group_id,
    telegram_data: item.telegram_data,
    glide_data: item.glide_data,
    media_metadata: item.media_metadata,
    message_media_data: messageMediaData,
    vendor_uid: item.vendor_uid || undefined,
    purchase_date: item.purchase_date || undefined,
    notes: item.notes || undefined,
    analyzed_content: item.analyzed_content || undefined,
    message_url: item.message_url || undefined,
    glide_app_url: item.glide_app_url || undefined,
    created_at: item.created_at,
    updated_at: item.updated_at,
    telegram_media_row_id: item.telegram_media_row_id || undefined,
    product_name: item.product_name || undefined,
    product_code: item.product_code || undefined,
    quantity: item.quantity || undefined
  };
};

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
        
        return (searchResults as TelegramMedia[]).map(mapToMediaItem);
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

      return (queryResult as TelegramMedia[]).map(mapToMediaItem);
    }
  });
};