import { supabase } from './supabase.ts';

export const insertMediaRecord = async (mediaData: any) => {
  try {
    const { data, error } = await supabase
      .from('telegram_media')
      .insert([mediaData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error inserting media record:', error);
    return null;
  }
};

export const updateMediaRecord = async (id: string, updates: any) => {
  try {
    const { data, error } = await supabase
      .from('telegram_media')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating media record:', error);
    return null;
  }
};

export const getMediaRecord = async (fileId: string) => {
  try {
    const { data, error } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_id', fileId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting media record:', error);
    return null;
  }
};

export const getMediaGroup = async (mediaGroupId: string) => {
  try {
    const { data, error } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('media_group_id', mediaGroupId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting media group:', error);
    return null;
  }
};
