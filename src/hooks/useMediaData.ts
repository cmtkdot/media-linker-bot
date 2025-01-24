import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, TelegramMessageData, MessageMediaData, ThumbnailSource } from "@/types/media";

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
        
        return searchResults.map((item: any): MediaItem => {
          const telegramData = item.telegram_data as TelegramMessageData;
          const messageData = telegramData?.message_data || {};
          
          const mediaMessageData: MessageMediaData = {
            message: {
              url: item.message_url || '',
              media_group_id: messageData?.media_group_id || '',
              caption: messageData?.caption || '',
              message_id: messageData?.message_id || 0,
              chat_id: messageData?.chat?.id || 0,
              date: messageData?.date || 0
            },
            sender: {
              sender_info: item.sender_info || {},
              chat_info: messageData?.chat || {}
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
            ...item,
            caption: messageData?.caption,
            media_group_id: messageData?.media_group_id,
            file_type: item.file_type as MediaItem['file_type'],
            telegram_data: telegramData,
            glide_data: item.glide_data || {},
            media_metadata: item.media_metadata || {},
            message_media_data: mediaMessageData,
            thumbnail_state: (item.thumbnail_state || 'pending') as MediaItem['thumbnail_state'],
            thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource,
          };
        });
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

      return (queryResult || []).map((item: any): MediaItem => {
        const telegramData = item.telegram_data as TelegramMessageData;
        const messageData = telegramData?.message_data || {};

        const mediaMessageData: MessageMediaData = {
          message: {
            url: item.message_url || '',
            media_group_id: messageData?.media_group_id || '',
            caption: messageData?.caption || '',
            message_id: messageData?.message_id || 0,
            chat_id: messageData?.chat?.id || 0,
            date: messageData?.date || 0
          },
          sender: {
            sender_info: item.sender_info || {},
            chat_info: messageData?.chat || {}
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
          ...item,
          caption: messageData?.caption,
          media_group_id: messageData?.media_group_id,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: telegramData,
          glide_data: item.glide_data || {},
          media_metadata: item.media_metadata || {},
          message_media_data: mediaMessageData,
          thumbnail_state: (item.thumbnail_state || 'pending') as MediaItem['thumbnail_state'],
          thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource,
        };
      });
    }
  });
};
