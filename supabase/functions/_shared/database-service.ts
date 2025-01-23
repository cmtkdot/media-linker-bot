import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageType, getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function processMediaFile(
  supabase: any,
  mediaFile: any,
  mediaType: string,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null
) {
  console.log(`Processing ${mediaType} file:`, {
    file_id: mediaFile.file_id,
    message_id: messageRecord?.id
  });

  // Check for existing media first
  const { data: existingMedia } = await withDatabaseRetry(
    async () => {
      return await supabase
        .from('telegram_media')
        .select('id, public_url')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();
    },
    0,
    `check_existing_media_${mediaFile.file_unique_id}`
  );

  if (existingMedia) {
    console.log('Media already exists:', existingMedia);
    return existingMedia;
  }

  // Download and process the file
  const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
  const fileExt = filePath.split('.').pop() || '';
  const uniqueFileName = `${mediaFile.file_unique_id}.${fileExt}`;

  console.log('Uploading file to storage:', {
    fileName: uniqueFileName,
    fileType: mediaType,
    mimeType: getMimeType(filePath, 'application/octet-stream')
  });

  // Upload to storage with retry
  await withDatabaseRetry(
    async () => {
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(uniqueFileName, buffer, {
          contentType: getMimeType(filePath, 'application/octet-stream'),
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;
    },
    0,
    `upload_file_${uniqueFileName}`
  );

  const { data: { publicUrl } } = await supabase.storage
    .from('media')
    .getPublicUrl(uniqueFileName);

  // Create media record with retry
  const { data: mediaRecord, error: insertError } = await withDatabaseRetry(
    async () => {
      return await supabase
        .from('telegram_media')
        .insert([{
          file_id: mediaFile.file_id,
          file_unique_id: mediaFile.file_unique_id,
          file_type: mediaType,
          message_id: messageRecord?.id,
          public_url: publicUrl,
          caption: message.caption,
          product_name: productInfo?.product_name,
          product_code: productInfo?.product_code,
          quantity: productInfo?.quantity,
          vendor_uid: productInfo?.vendor_uid,
          purchase_date: productInfo?.purchase_date,
          notes: productInfo?.notes,
          analyzed_content: productInfo?.analyzed_content,
          telegram_data: {
            message_id: message.message_id,
            chat_id: message.chat.id,
            media_group_id: message.media_group_id,
            date: message.date,
            storage_path: uniqueFileName
          }
        }])
        .select()
        .single();
    },
    0,
    `create_media_record_${mediaFile.file_unique_id}`
  );

  if (insertError) throw insertError;

  console.log('Successfully processed media file:', {
    file_id: mediaFile.file_id,
    type: mediaType,
    public_url: publicUrl,
    record_id: mediaRecord?.id
  });

  return mediaRecord;
}