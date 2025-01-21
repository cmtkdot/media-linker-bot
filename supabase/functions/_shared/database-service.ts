import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const fileInfo = await getFileInfo(mediaFile.file_id, botToken);
  if (!fileInfo || !fileInfo.file_path) {
    throw new Error('Could not get file info from Telegram');
  }

  const fileExt = fileInfo.file_path.split('.').pop();
  const uniqueFileName = `${mediaType}_${mediaFile.file_unique_id}_${Date.now()}.${fileExt}`;

  const fileResponse = await downloadTelegramFile(fileInfo.file_path, botToken);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(uniqueFileName, fileResponse.body, {
      contentType: mediaFile.mime_type || 'application/octet-stream',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  const telegramData = {
    message_id: message.message_id,
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

  const { error: dbError } = await supabase
    .from('telegram_media')
    .insert({
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: mediaType,
      telegram_data: telegramData,
      message_id: messageRecord.id,
      public_url: `https://kzfamethztziwqiocbwz.supabase.co/storage/v1/object/public/media/${uniqueFileName}`,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity
      })
    });

  if (dbError) {
    throw new Error(`Failed to insert into database: ${dbError.message}`);
  }
}