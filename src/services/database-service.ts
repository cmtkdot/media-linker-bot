import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MediaItemUpdate } from "@/types/media";

export const getMediaItem = async (id: string): Promise<MediaItem> => {
  const { data, error } = await supabase
    .from('telegram_media')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data as unknown as MediaItem;
};

export const getMediaItems = async (): Promise<MediaItem[]> => {
  const { data, error } = await supabase
    .from('telegram_media')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data as unknown as MediaItem[];
};

export const updateMediaItem = async (id: string, updates: MediaItemUpdate): Promise<MediaItem> => {
  const { data, error } = await supabase
    .from('telegram_media')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as unknown as MediaItem;
};

export const deleteMediaItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('telegram_media')
    .delete()
    .eq('id', id);

  if (error) throw error;
};