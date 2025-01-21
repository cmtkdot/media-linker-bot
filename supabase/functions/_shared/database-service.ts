import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';

export async function createMessage(supabase: any, message: any, productInfo: any = null) {
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .insert({
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: getMessageType(message),
      message_data: message,
      caption: message.caption,
      media_group_id: message.media_group_id,
      status: 'pending',
      retry_count: 0,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity
      })
    })
    .select()
    .single();

  if (messageError) throw messageError;
  return messageData;
}

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
    // Check for existing media to prevent duplicates
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, public_url')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .eq('telegram_data->chat_id', message.chat.id)
      .eq('telegram_data->message_id', message.message_id)
      .single();

    if (existingMedia) {
      console.log('Media already exists:', existingMedia);
      return existingMedia;
    }

    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    
    const fileExt = filePath.split('.').pop() || '';
    const uniqueFileName = generateSafeFileName(
      `${mediaType}_${mediaFile.file_unique_id}_${Date.now()}`,
      fileExt
    );

    console.log('Uploading file:', uniqueFileName);
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

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(uniqueFileName);

    // Ensure numeric values are properly handled
    const telegramData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_size: mediaFile.file_size ? BigInt(mediaFile.file_size).toString() : null,
      mime_type: mediaFile.mime_type,
      width: mediaFile.width ? BigInt(mediaFile.width).toString() : null,
      height: mediaFile.height ? BigInt(mediaFile.height).toString() : null,
      duration: 'duration' in mediaFile ? BigInt(mediaFile.duration).toString() : null,
      storage_path: uniqueFileName
    };

    console.log('Inserting media record with data:', {
      file_id: mediaFile.file_id,
      file_type: mediaType,
      public_url: publicUrl,
      message_id: messageRecord.id
    });

    const { error: dbError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: mediaFile.file_id,
        file_unique_id: mediaFile.file_unique_id,
        file_type: mediaType,
        telegram_data: telegramData,
        message_id: messageRecord.id,
        public_url: publicUrl,
        caption: message.caption,
        ...(productInfo && {
          product_name: productInfo.product_name,
          product_code: productInfo.product_code,
          quantity: productInfo.quantity ? BigInt(productInfo.quantity).toString() : null
        })
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    console.log(`Successfully processed ${mediaType} file:`, uniqueFileName);
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}