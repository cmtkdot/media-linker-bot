import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MessageMediaData, TelegramMessageData } from "@/types/media";
import { Database } from "@/integrations/supabase/types";

type TelegramMedia = Database['public']['Tables']['telegram_media']['Row'];

const defaultMessageMediaData: MessageMediaData = {
  message: {
    url: '',
    media_group_id: '',
    caption: '',
    message_id: 0,
    chat_id: 0,
    date: 0
  },
  sender: {
    sender_info: {},
    chat_info: {}
  },
  analysis: {
    analyzed_content: {},
    product_name: null,
    product_code: null,
    quantity: null,
    vendor_uid: null,
    purchase_date: null,
    notes: null,
    purchase_order_uid: null
  },
  meta: {
    created_at: '',
    updated_at: '',
    status: 'pending',
    error: null
  },
  media: {
    public_url: null,
    default_public_url: null,
    file_type: null
  },
  glide: {
    row_id: null,
    app_url: null,
    last_synced_at: null
  }
};

const mapToMediaItem = (item: TelegramMedia): MediaItem => {
  let messageMediaData: MessageMediaData;
  if (
    item.message_media_data && 
    typeof item.message_media_data === 'object' && 
    item.message_media_data !== null
  ) {
    const data = item.message_media_data as Record<string, any>;
    messageMediaData = {
      message: {
        url: typeof data.message?.url === 'string' ? data.message.url : defaultMessageMediaData.message.url,
        media_group_id: typeof data.message?.media_group_id === 'string' ? data.message.media_group_id : defaultMessageMediaData.message.media_group_id,
        caption: typeof data.message?.caption === 'string' ? data.message.caption : defaultMessageMediaData.message.caption,
        message_id: typeof data.message?.message_id === 'number' ? data.message.message_id : defaultMessageMediaData.message.message_id,
        chat_id: typeof data.message?.chat_id === 'number' ? data.message.chat_id : defaultMessageMediaData.message.chat_id,
        date: typeof data.message?.date === 'number' ? data.message.date : defaultMessageMediaData.message.date
      },
      sender: {
        sender_info: typeof data.sender?.sender_info === 'object' ? data.sender.sender_info : {},
        chat_info: typeof data.sender?.chat_info === 'object' ? data.sender.chat_info : {}
      },
      analysis: {
        analyzed_content: typeof data.analysis?.analyzed_content === 'object' ? data.analysis.analyzed_content : {},
        product_name: typeof data.analysis?.product_name === 'string' ? data.analysis.product_name : null,
        product_code: typeof data.analysis?.product_code === 'string' ? data.analysis.product_code : null,
        quantity: typeof data.analysis?.quantity === 'number' ? data.analysis.quantity : null,
        vendor_uid: typeof data.analysis?.vendor_uid === 'string' ? data.analysis.vendor_uid : null,
        purchase_date: typeof data.analysis?.purchase_date === 'string' ? data.analysis.purchase_date : null,
        notes: typeof data.analysis?.notes === 'string' ? data.analysis.notes : null,
        purchase_order_uid: typeof data.analysis?.purchase_order_uid === 'string' ? data.analysis.purchase_order_uid : null
      },
      meta: {
        created_at: typeof data.meta?.created_at === 'string' ? data.meta.created_at : defaultMessageMediaData.meta.created_at,
        updated_at: typeof data.meta?.updated_at === 'string' ? data.meta.updated_at : defaultMessageMediaData.meta.updated_at,
        status: typeof data.meta?.status === 'string' ? data.meta.status as MessageMediaData['meta']['status'] : defaultMessageMediaData.meta.status,
        error: typeof data.meta?.error === 'string' ? data.meta.error : null
      },
      media: {
        public_url: typeof data.media?.public_url === 'string' ? data.media.public_url : null,
        default_public_url: typeof data.media?.default_public_url === 'string' ? data.media.default_public_url : null,
        file_type: typeof data.media?.file_type === 'string' ? data.media.file_type : null
      },
      glide: {
        row_id: typeof data.glide?.row_id === 'string' ? data.glide.row_id : null,
        app_url: typeof data.glide?.app_url === 'string' ? data.glide.app_url : null,
        last_synced_at: typeof data.glide?.last_synced_at === 'string' ? data.glide.last_synced_at : null
      }
    };
  } else {
    messageMediaData = defaultMessageMediaData;
  }

  return {
    id: item.id,
    file_id: item.file_id,
    file_unique_id: item.file_unique_id,
    file_type: item.file_type as MediaItem['file_type'],
    public_url: messageMediaData.media.public_url || item.public_url,
    default_public_url: messageMediaData.media.default_public_url || item.default_public_url,
    media_group_id: messageMediaData.message.media_group_id,
    telegram_data: item.telegram_data as TelegramMessageData,
    glide_data: item.glide_data as Record<string, any>,
    media_metadata: item.media_metadata as Record<string, any>,
    message_media_data: messageMediaData,
    vendor_uid: messageMediaData.analysis.vendor_uid || item.vendor_uid,
    purchase_date: messageMediaData.analysis.purchase_date || item.purchase_date?.toString(),
    notes: messageMediaData.analysis.notes || item.notes,
    analyzed_content: messageMediaData.analysis.analyzed_content || item.analyzed_content as Record<string, any>,
    message_url: messageMediaData.message.url || item.message_url,
    glide_app_url: messageMediaData.glide.app_url || item.glide_app_url,
    created_at: messageMediaData.meta.created_at || item.created_at,
    updated_at: messageMediaData.meta.updated_at || item.updated_at,
    telegram_media_row_id: messageMediaData.glide.row_id || item.telegram_media_row_id,
    product_name: messageMediaData.analysis.product_name || item.product_name,
    product_code: messageMediaData.analysis.product_code || item.product_code,
    quantity: messageMediaData.analysis.quantity || item.quantity
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