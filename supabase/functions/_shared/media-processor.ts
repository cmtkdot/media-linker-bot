import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';

export async function processMediaFile(
  supabase: any,
  mediaFile: any,
  mediaType: string,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null
) {
  console.log(`Processing ${mediaType} file:`, mediaFile.file_id);

  try {
    // Check for existing media using file_unique_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .single();

    // Prepare telegram data with proper caption handling
    const telegramData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption || (message.media_group_id ? messageRecord.caption : null),
      media_group_id: message.media_group_id,
      file_size: mediaFile.file_size ? BigInt(mediaFile.file_size).toString() : null,
      mime_type: mediaFile.mime_type || (mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
      width: mediaFile.width ? BigInt(mediaFile.width).toString() : null,
      height: mediaFile.height ? BigInt(mediaFile.height).toString() : null,
      duration: 'duration' in mediaFile ? BigInt(mediaFile.duration).toString() : null
    };

    if (existingMedia) {
      console.log('Media already exists, updating related records:', existingMedia);

      // Update the existing telegram_media record with new message data
      const { error: mediaUpdateError } = await supabase
        .from('telegram_media')
        .update({
          telegram_data: {
            ...existingMedia.telegram_data,
            ...telegramData
          },
          caption: message.caption || messageRecord.caption,
          product_name: messageRecord.product_name,
          product_code: messageRecord.product_code,
          quantity: messageRecord.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMedia.id);

      if (mediaUpdateError) {
        console.error('Error updating existing media:', mediaUpdateError);
        throw mediaUpdateError;
      }

      // Update the message record with the existing media information
      const { error: messageUpdateError } = await supabase
        .from('messages')
        .update({
          message_data: {
            ...messageRecord.message_data,
            media_info: {
              file_id: mediaFile.file_id,
              file_unique_id: mediaFile.file_unique_id,
              public_url: existingMedia.public_url
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', messageRecord.id);

      if (messageUpdateError) {
        console.error('Error updating message record:', messageUpdateError);
        throw messageUpdateError;
      }

      return {
        public_url: existingMedia.public_url,
        reused: true
      };
    }

    // If media doesn't exist, proceed with new upload
    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    
    const fileExt = filePath.split('.').pop() || '';
    const uniqueFileName = generateSafeFileName(
      `${mediaType}_${mediaFile.file_unique_id}`,
      fileExt
    );

    console.log('Uploading new file:', uniqueFileName);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(uniqueFileName, buffer, {
        contentType: mediaFile.mime_type || 'application/octet-stream',
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(uniqueFileName);

    // Add storage path to telegram data
    telegramData['storage_path'] = uniqueFileName;

    console.log('Inserting new media record');
    const { error: dbError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: mediaFile.file_id,
        file_unique_id: mediaFile.file_unique_id,
        file_type: mediaType,
        telegram_data: telegramData,
        message_id: messageRecord.id,
        public_url: publicUrl,
        caption: message.caption || messageRecord.caption,
        product_name: messageRecord.product_name,
        product_code: messageRecord.product_code,
        quantity: messageRecord.quantity
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    // Update message record with the new media information
    const { error: messageUpdateError } = await supabase
      .from('messages')
      .update({
        message_data: {
          ...messageRecord.message_data,
          media_info: {
            file_id: mediaFile.file_id,
            file_unique_id: mediaFile.file_unique_id,
            public_url: publicUrl
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', messageRecord.id);

    if (messageUpdateError) {
      console.error('Error updating message record:', messageUpdateError);
      throw messageUpdateError;
    }

    console.log(`Successfully processed ${mediaType} file:`, uniqueFileName);
    return { public_url: publicUrl, reused: false };
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}