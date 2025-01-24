import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MediaFileType, ThumbnailState, ThumbnailSource, MessageMediaData } from "@/types/media";

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
      let query = supabase
        .from('telegram_media')
        .select('*');

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      if (selectedChannel !== "all") {
        query = query.eq('telegram_data->>chat->>title', selectedChannel);
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

      return queryResult.map((item): MediaItem => {
        const analyzedContent = {
          text: '',
          labels: [],
          objects: []
        };

        if (item.analyzed_content && typeof item.analyzed_content === 'object') {
          const content = item.analyzed_content as Record<string, unknown>;
          analyzedContent.text = typeof content.text === 'string' ? content.text : '';
          analyzedContent.labels = Array.isArray(content.labels) ? content.labels : [];
          analyzedContent.objects = Array.isArray(content.objects) ? content.objects : [];
        }

        const messageMediaData: MessageMediaData = {
          message: {
            url: item.message_url || '',
            media_group_id: item.telegram_data?.media_group_id || '',
            caption: item.caption || '',
            message_id: item.telegram_data?.message_id || 0,
            chat_id: item.telegram_data?.chat_id || 0,
            date: item.telegram_data?.date || 0
          },
          sender: {
            sender_info: item.sender_info || {},
            chat_info: item.telegram_data?.chat || {}
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
          file_type: item.file_type as MediaFileType,
          telegram_data: item.telegram_data as Record<string, any>,
          glide_data: item.glide_data as Record<string, any>,
          media_metadata: item.media_metadata as Record<string, any>,
          analyzed_content: analyzedContent,
          message_media_data: messageMediaData,
          thumbnail_state: (item.thumbnail_state || 'pending') as ThumbnailState,
          thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource
        };
      });
    }
  });
};