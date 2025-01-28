import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MediaItemUpdate, MessageMediaData } from "@/types/media";
import { Json } from "@/integrations/supabase/types";

export const convertToMediaItem = (data: any): MediaItem => ({
  ...data,
  message_media_data: data.message_media_data || {
    message: {},
    sender: {},
    analysis: {},
    meta: {
      created_at: data.created_at,
      updated_at: data.updated_at,
      status: 'pending',
      error: null
    },
    media: {},
    telegram_data: {}
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
  // Update message_media_data meta with is_original_caption if it exists
  if (updates.is_original_caption !== undefined) {
    updates.message_media_data = {
      ...updates.message_media_data,
      meta: {
        ...updates.message_media_data?.meta,
        is_original_caption: updates.is_original_caption,
        original_message_id: updates.original_message_id
      }
    };
  }

  const { data, error } = await supabase
    .from('telegram_media')
    .update(updates)
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