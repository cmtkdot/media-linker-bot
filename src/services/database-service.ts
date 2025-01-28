import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MediaItemUpdate, MessageMediaData } from "@/types/media";
import { Json } from "@/integrations/supabase/types";

export const convertToMediaItem = (data: any): MediaItem => ({
  ...data,
  message_media_data: data.message_media_data || {
    message: {},
    sender: {},
    analysis: {
      analyzed_content: {},
      product_name: data.product_name,
      product_code: data.product_code,
      quantity: data.quantity,
      vendor_uid: data.vendor_uid,
      purchase_date: data.purchase_date,
      notes: data.notes
    },
    meta: {
      created_at: data.created_at,
      updated_at: data.updated_at,
      status: data.processed ? 'processed' : 'pending',
      error: data.processing_error,
      is_original_caption: data.is_original_caption,
      original_message_id: data.original_message_id,
      correlation_id: data.correlation_id
    },
    media: {
      file_id: data.file_id,
      file_unique_id: data.file_unique_id,
      file_type: data.file_type,
      public_url: data.public_url,
      storage_path: data.storage_path
    },
    telegram_data: data.telegram_data || {}
  },
  telegram_data: data.message_media_data?.telegram_data || {},
  glide_data: data.glide_data || {},
  media_metadata: data.message_media_data?.media || {},
  analyzed_content: data.message_media_data?.analysis?.analyzed_content || {}
});

export const getMediaItem = async (id: string): Promise<MediaItem> => {
  const { data, error } = await supabase
    .from('telegram_media')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return convertToMediaItem(data);
};

export const getMediaItems = async (): Promise<MediaItem[]> => {
  const { data, error } = await supabase
    .from('telegram_media')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(convertToMediaItem);
};

export const updateMediaItem = async (id: string, updates: Partial<MediaItem>): Promise<MediaItem> => {
  const messageMediaData = {
    ...updates.message_media_data,
    analysis: {
      ...updates.message_media_data?.analysis,
      product_name: updates.product_name,
      product_code: updates.product_code,
      quantity: updates.quantity,
      vendor_uid: updates.vendor_uid,
      purchase_date: updates.purchase_date,
      notes: updates.notes
    },
    meta: {
      ...updates.message_media_data?.meta,
      updated_at: new Date().toISOString(),
      status: updates.processed ? 'processed' : 'pending',
      error: updates.processing_error
    },
    media: {
      ...updates.message_media_data?.media,
      file_id: updates.file_id,
      file_unique_id: updates.file_unique_id,
      file_type: updates.file_type,
      public_url: updates.public_url,
      storage_path: updates.storage_path
    }
  };

  const { data, error } = await supabase
    .from('telegram_media')
    .update({
      message_media_data: messageMediaData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return convertToMediaItem(data);
};

export const deleteMediaItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('telegram_media')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
