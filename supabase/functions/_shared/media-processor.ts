import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { handleMediaGroup } from './media-group-handler.ts';
import { processMediaFile } from './database-service.ts';

export async function updateExistingMedia(supabase: any, mediaFile: any, message: any, messageRecord: any) {
  console.log('Updating existing media record for file_unique_id:', mediaFile.file_unique_id, {
    message_id: message.message_id,
    chat_id: message.chat.id
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

    console.log('Updating telegram_media record:', {
      id: existingMedia.id,
      message_id: message.message_id
    });

    // Update telegram_media record
    const { error: mediaError } = await supabase
      .from('telegram_media')
      .update({
        telegram_data: telegramData,
        caption: message.caption,
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
      message_id: message.message_id
    });

    // Update message record
    const { error: messageError } = await supabase
      .from('messages')
      .update({
        message_data: message,
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

async function ensureStorageBucket(supabase: any) {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      throw listError;
    }

    const mediaBucket = buckets.find((b: any) => b.name === 'media');
    
    if (!mediaBucket) {
      console.log('Creating media storage bucket');
      const { error: createError } = await supabase.storage.createBucket('media', {
        public: true,
        allowedMimeTypes: ['image/*', 'video/*', 'application/octet-stream'],
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (createError) throw createError;
    } else {
      // Update bucket to ensure it's public
      const { error: updateError } = await supabase.storage.updateBucket('media', {
        public: true,
        allowedMimeTypes: ['image/*', 'video/*', 'application/octet-stream'],
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
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
  console.log(`Processing new ${mediaType} file:`, mediaFile.file_id);

  // Ensure storage bucket exists and is public
  await ensureStorageBucket(supabase);

  const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
  
  // Improved MIME type and extension handling
  let mimeType = mediaFile.mime_type;
  let fileExt = filePath.split('.').pop() || '';
  
  // Handle photos specifically
  if (mediaType === 'photo') {
    mimeType = 'image/jpeg';
    fileExt = 'jpg';
  } else if (!mimeType) {
    // Fallback MIME type detection based on media type
    switch(mediaType) {
      case 'video':
        mimeType = 'video/mp4';
        break;
      case 'document':
        mimeType = fileExt ? `application/${fileExt}` : 'application/octet-stream';
        break;
      case 'animation':
        mimeType = 'image/gif';
        break;
      default:
        mimeType = 'application/octet-stream';
    }
  }
  
  console.log('Determined file type:', {
    mediaType,
    mimeType,
    fileExt,
    originalMimeType: mediaFile.mime_type
  });
    
  const uniqueFileName = generateSafeFileName(
    `${mediaType}_${mediaFile.file_unique_id}_${Date.now()}`,
    fileExt
  );

  console.log('Uploading file:', uniqueFileName);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(uniqueFileName, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Get the public URL for the uploaded file
  const { data: { publicUrl }, error: urlError } = await supabase.storage
    .from('media')
    .getPublicUrl(uniqueFileName);

  if (urlError) {
    console.error('Error getting public URL:', urlError);
    throw new Error(`Failed to get public URL: ${urlError.message}`);
  }

  console.log('Got public URL:', publicUrl);

  const telegramData = {
    message_id: message.message_id,
    chat_id: message.chat.id,
    sender_chat: message.sender_chat,
    chat: message.chat,
    date: message.date,
    caption: message.caption,
    media_group_id: message.media_group_id,
    file_size: mediaFile.file_size ? BigInt(mediaFile.file_size).toString() : null,
    mime_type: mimeType,
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

  await handleMediaGroup(supabase, message, messageRecord);
  
  return { public_url: publicUrl };
}
