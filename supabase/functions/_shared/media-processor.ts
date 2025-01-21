import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';

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
    product_info: productInfo,
    message_record: {
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity
    }
  });

  try {
    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    
    const fileExt = filePath.split('.').pop()?.toLowerCase() || '';
    const uniqueFileName = generateSafeFileName(
      `${mediaType}_${mediaFile.file_unique_id}_${Date.now()}`,
      fileExt
    );

    // Determine the correct content type based on media type and file extension
    let contentType = mediaFile.mime_type || 'application/octet-stream';
    if (mediaType === 'photo' && !mediaFile.mime_type) {
      contentType = 'image/jpeg'; // Default to JPEG for photos
    } else if (fileExt) {
      // Map common extensions to MIME types
      const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'pdf': 'application/pdf'
      };
      contentType = mimeTypes[fileExt] || contentType;
    }

    console.log('Uploading file:', {
      fileName: uniqueFileName,
      contentType: contentType,
      mediaType: mediaType,
      fileExt: fileExt
    });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(uniqueFileName, buffer, {
        contentType: contentType,
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
      mime_type: contentType,
      width: mediaFile.width ? BigInt(mediaFile.width).toString() : null,
      height: mediaFile.height ? BigInt(mediaFile.height).toString() : null,
      duration: 'duration' in mediaFile ? BigInt(mediaFile.duration).toString() : null,
      storage_path: uniqueFileName
    };

    // Get product info from messageRecord if not provided
    const mediaProductInfo = {
      caption: message.caption,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date,
      notes: messageRecord.notes
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
        caption: message.caption,
        product_name: mediaProductInfo.product_name,
        product_code: mediaProductInfo.product_code,
        quantity: mediaProductInfo.quantity,
        vendor_uid: mediaProductInfo.vendor_uid,
        purchase_date: mediaProductInfo.purchase_date,
        notes: mediaProductInfo.notes
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    console.log(`Successfully processed ${mediaType} file:`, {
      fileName: uniqueFileName,
      product_info: mediaProductInfo
    });

    return { public_url: publicUrl };
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}

export async function updateExistingMedia(supabase: any, mediaFile: any, message: any, messageRecord: any) {
  console.log('Updating existing media record for file_unique_id:', mediaFile.file_unique_id, {
    message_id: message.message_id,
    chat_id: message.chat.id,
    product_info: {
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date,
      notes: messageRecord.notes
    }
  });
  
  try {
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
      purchase_date: messageRecord.purchase_date,
      notes: messageRecord.notes
    };

    console.log('Updating telegram_media record with new data:', {
      id: existingMedia.id,
      ...productInfo
    });

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