import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function downloadAndStoreThumbnail(
  thumbData: { file_id: string; file_unique_id: string },
  botToken: string,
  supabase: any
): Promise<string | null> {
  try {
    console.log('Downloading thumbnail:', thumbData);

    const { buffer, filePath } = await getAndDownloadTelegramFile(
      thumbData.file_id,
      botToken
    );

    const fileName = `${thumbData.file_unique_id}.jpg`;
    console.log('Storing thumbnail:', fileName);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading thumbnail:', uploadError);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    console.log('Thumbnail uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error processing thumbnail:', error);
    throw error; // Throw error to be handled by caller
  }
}