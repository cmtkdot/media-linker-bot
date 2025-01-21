import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { handleMediaGroup } from './media-group-handler.ts';

export async function updateExistingMedia(supabase: any, mediaFile: any, message: any, messageRecord: any) {
  console.log('Updating existing media record for file_unique_id:', mediaFile.file_unique_id, {
    message_id: message.message_id,
    chat_id: message.chat.id,
    product_info: {
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date
    }
  });
  
  try {
    // Get existing media record
    const { data: existingMedia, error: mediaFetchError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .maybeSingle();

    if (mediaFetchError) {
      console.error('Error fetching existing media:', {
        error: mediaFetchError,
        file_unique_id: mediaFile.file_unique_id
      });
      throw mediaFetchError;
    }

    if (!existingMedia) {
      console.error('Existing media record not found:', {
        file_unique_id: mediaFile.file_unique_id
      });
      throw new Error('Existing media record not found');
    }

    // Prepare telegram data with updated message info
    const telegramData = {
      ...existingMedia.telegram_data,
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
    };

    // Extract all product info from messageRecord
    const productInfo = {
      caption: message.caption,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date
    };

    console.log('Updating telegram_media record with new data:', {
      id: existingMedia.id,
      ...productInfo
    });

    // Update telegram_media record with all fields
    const { error: mediaError } = await supabase
      .from('telegram_media')
      .update({
        telegram_data: telegramData,
        ...productInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMedia.id);

    if (mediaError) {
      console.error('Error updating telegram_media:', {
        error: mediaError,
        media_id: existingMedia.id
      });
      throw mediaError;
    }

    console.log('Updating message record:', {
      id: messageRecord.id,
      message_id: message.message_id,
      product_info: productInfo
    });

    // Update message record with all fields
    const { error: messageError } = await supabase
      .from('messages')
      .update({
        message_data: message,
        ...productInfo,
        updated_at: new Date().toISOString(),
        status: 'success',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageRecord.id);

    if (messageError) {
      console.error('Error updating message:', {
        error: messageError,
        message_id: messageRecord.id
      });
      throw messageError;
    }

    // Handle media group updates if needed
    if (message.media_group_id) {
      await handleMediaGroup(supabase, message, messageRecord);
    }

    return existingMedia;
  } catch (error) {
    console.error('Error in updateExistingMedia:', {
      error: error.message,
      stack: error.stack,
      file_unique_id: mediaFile.file_unique_id
    });
    throw error;
  }
}

export async function processNewMedia(
  supabase: any,
  mediaFile: any,
  mediaType: string,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null
) {
  console.log(`Processing new ${mediaType} file:`, {
    file_id: mediaFile.file_id,
    product_info: productInfo
  });

  try {
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

    // Prepare product info from messageRecord
    const mediaProductInfo = {
      caption: message.caption,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date
    };

    console.log('Inserting media record with data:', {
      file_id: mediaFile.file_id,
      file_type: mediaType,
      public_url: publicUrl,
      message_id: messageRecord.id,
      product_info: mediaProductInfo
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
        ...mediaProductInfo
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    // Handle media group updates if needed
    if (message.media_group_id) {
      await handleMediaGroup(supabase, message, messageRecord);
    }

    return { public_url: publicUrl };
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}