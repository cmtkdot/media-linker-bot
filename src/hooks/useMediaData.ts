import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MediaFileType, ThumbnailState, ThumbnailSource } from "@/types/media";

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
        // Initialize analyzed_content with default values
        const analyzedContent = {
          text: '',
          labels: [],
          objects: []
        };

        // Parse analyzed_content if it exists and is an object
        if (item.analyzed_content && typeof item.analyzed_content === 'object') {
          const content = item.analyzed_content as Record<string, unknown>;
          analyzedContent.text = typeof content.text === 'string' ? content.text : '';
          analyzedContent.labels = Array.isArray(content.labels) ? content.labels : [];
          analyzedContent.objects = Array.isArray(content.objects) ? content.objects : [];
        }

        const telegramData = item.telegram_data as Record<string, any>;
        const messageMediaData = item.message_media_data as Record<string, any> || {
          message: {
            url: item.message_url,
            media_group_id: telegramData?.media_group_id,
            caption: item.caption,
            message_id: telegramData?.message_id,
            chat_id: telegramData?.chat_id,
            date: telegramData?.date
          },
          sender: {
            sender_info: item.sender_info || {},
            chat_info: telegramData?.chat || {}
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
          file_type: item.file_type as MediaFileType,
          public_url: item.public_url,
          default_public_url: item.default_public_url,
          thumbnail_url: item.thumbnail_url,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          telegram_data: telegramData,
          glide_data: item.glide_data as Record<string, any>,
          media_metadata: item.media_metadata as Record<string, any>,
          analyzed_content: analyzedContent,
          caption: item.caption,
          vendor_uid: item.vendor_uid,
          purchase_date: item.purchase_date,
          notes: item.notes,
          message_url: item.message_url,
          glide_app_url: item.glide_app_url,
          created_at: item.created_at,
          updated_at: item.updated_at,
          telegram_media_row_id: item.telegram_media_row_id,
          thumbnail_state: (item.thumbnail_state || 'pending') as ThumbnailState,
          thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource,
          thumbnail_error: item.thumbnail_error,
          message_media_data: messageMediaData
        };
      });
    }
  });
};