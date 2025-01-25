import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MediaItemUpdate } from "@/types/media";

const convertToMediaItem = (data: any): MediaItem => ({
  ...data,
  message_media_data: data.message_media_data as MediaItem['message_media_data'],
  telegram_data: data.telegram_data as Record<string, any>,
  glide_data: data.glide_data as Record<string, any>,
  media_metadata: data.media_metadata as Record<string, any>,
  analyzed_content: data.analyzed_content as Record<string, any>,
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
  const { data, error } = await supabase
    .from('telegram_media')
    .update(updates as any)
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