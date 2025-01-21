import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';

export async function createMessage(supabase: any, message: any, productInfo: any = null) {
  console.log('Creating message:', { 
    message_id: message.message_id, 
    chat_id: message.chat.id,
    product_info: productInfo 
  });

  try {
    const messageData = {
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
        quantity: productInfo.quantity,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes,
        analyzed_content: productInfo
      })
    };

    const { data: existingMessage, error: checkError } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();

    if (existingMessage) {
      const { data: updatedMessage, error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedMessage;
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;
    return newMessage;
  } catch (error) {
    console.error('Error in createMessage:', error);
    throw error;
  }
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
  console.log(`Processing ${mediaType} file:`, {
    file_id: mediaFile.file_id,
    message_id: messageRecord?.id
  });

  try {
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
      productInfo?.product_name,
      productInfo?.product_code,
      mediaType,
      fileExt
    );

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(uniqueFileName, buffer, {
        contentType: mediaFile.mime_type || 'application/octet-stream',
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) throw new Error(`Failed to upload file: ${uploadError.message}`);

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(uniqueFileName);

    const telegramData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_size: mediaFile.file_size,
      mime_type: mediaFile.mime_type,
      width: mediaFile.width,
      height: mediaFile.height,
      duration: 'duration' in mediaFile ? mediaFile.duration : null,
      storage_path: uniqueFileName
    };

    const mediaRecord = {
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: mediaType,
      telegram_data: telegramData,
      message_id: messageRecord?.id,
      public_url: publicUrl,
      caption: message.caption,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes,
        analyzed_content: productInfo
      })
    };

    const { data: mediaData, error: dbError } = await supabase
      .from('telegram_media')
      .insert(mediaRecord)
      .select()
      .single();

    if (dbError) throw new Error(`Failed to insert into database: ${dbError.message}`);
    return mediaData;
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}