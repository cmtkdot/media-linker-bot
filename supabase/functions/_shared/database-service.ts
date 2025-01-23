import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageType, getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';

export async function createMessage(supabase: any, message: any, productInfo: any = null) {
  if (!message?.message_id || !message?.chat?.id) {
    console.error('Invalid message data:', { message });
    throw new Error('Invalid message data: missing required fields');
  }

  console.log('Creating message:', { 
    message_id: message.message_id, 
    chat_id: message.chat.id,
    product_info: productInfo 
  });

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
    .maybeSingle();

  if (checkError) throw checkError;

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
  if (!newMessage) throw new Error('Failed to create message record: no data returned');

  return newMessage;
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

  // Check for existing media first
  const { data: existingMedia } = await supabase
    .from('telegram_media')
    .select('id, public_url')
    .eq('file_unique_id', mediaFile.file_unique_id)
    .maybeSingle();

  if (existingMedia) {
    console.log('Media already exists:', existingMedia);
    return existingMedia;
  }

  // Download and process the file
  const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
  const fileExt = filePath.split('.').pop() || '';
  const uniqueFileName = `${mediaFile.file_unique_id}.${fileExt}`;

  // Determine MIME type
  const mimeType = mediaFile.mime_type || 
    (mediaType === 'photo' ? 'image/jpeg' : getMimeType(filePath, 'application/octet-stream'));

  console.log('Uploading file with MIME type:', mimeType);

  // Check if file already exists in storage
  const { data: existingFile } = await supabase.storage
    .from('media')
    .list('', {
      search: uniqueFileName
    });

  if (existingFile && existingFile.length > 0) {
    console.log('File already exists in storage:', uniqueFileName);
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(uniqueFileName);
    return { public_url: publicUrl };
  }

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(uniqueFileName, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600'
    });

  if (uploadError) throw new Error(`Failed to upload file: ${uploadError.message}`);

  const { data: { publicUrl } } = await supabase.storage
    .from('media')
    .getPublicUrl(uniqueFileName);

  // Create media record
  const mediaRecord = {
    file_id: mediaFile.file_id,
    file_unique_id: mediaFile.file_unique_id,
    file_type: mediaType,
    message_id: messageRecord?.id,
    public_url: publicUrl,
    telegram_data: {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      storage_path: uniqueFileName
    },
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
}