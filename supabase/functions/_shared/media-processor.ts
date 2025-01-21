import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { handleMediaGroup } from './media-group-handler.ts';
import { processMediaFile } from './database-service.ts';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function updateExistingMedia(supabase: any, mediaFile: any, message: any, messageRecord: any) {
  console.log('Updating existing media record for file_unique_id:', mediaFile.file_unique_id, {
    message_id: message.message_id,
    chat_id: message.chat.id
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

    // Extract video metadata if available
    const videoMetadata = message.video ? {
      duration: message.video.duration,
      width: message.video.width,
      height: message.video.height,
      thumb: message.video.thumb
    } : null;

    // Prepare telegram data with updated message info and metadata
    const telegramData = {
      ...existingMedia.telegram_data,
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      ...(videoMetadata && { video_metadata: videoMetadata })
    };

    console.log('Updating telegram_media record:', {
      id: existingMedia.id,
      message_id: message.message_id
    });

    // Update telegram_media record with enhanced metadata
    const { error: mediaError } = await supabase
      .from('telegram_media')
      .update({
        telegram_data: telegramData,
        caption: message.caption,
        media_metadata: {
          ...existingMedia.media_metadata,
          ...(videoMetadata && { video: videoMetadata })
        },
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

async function validateMediaFile(file: any, mediaType: string) {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Validate file type
  const allowedTypes = mediaType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
}

async function ensureStorageBucket(supabase: any) {
  try {
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
        allowedMimeTypes: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES],
        fileSizeLimit: MAX_FILE_SIZE
      });
      
      if (createError) throw createError;
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

  try {
    // Validate media file
    await validateMediaFile(mediaFile, mediaType);

    // Ensure storage bucket exists and is properly configured
    await ensureStorageBucket(supabase);

    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    
    // Enhanced MIME type handling
    let mimeType = mediaFile.mime_type;
    let fileExt = filePath.split('.').pop() || '';
    
    if (mediaType === 'photo') {
      mimeType = 'image/jpeg';
      fileExt = 'jpg';
    } else if (mediaType === 'video' && !mimeType) {
      mimeType = 'video/mp4';
      fileExt = 'mp4';
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

    // Get the public URL
    const { data: { publicUrl }, error: urlError } = await supabase.storage
      .from('media')
      .getPublicUrl(uniqueFileName);

    if (urlError) {
      console.error('Error getting public URL:', urlError);
      throw new Error(`Failed to get public URL: ${urlError.message}`);
    }

    console.log('Got public URL:', publicUrl);

    // Extract video metadata if available
    const videoMetadata = message.video ? {
      duration: message.video.duration,
      width: message.video.width,
      height: message.video.height,
      thumb: message.video.thumb
    } : null;

    const telegramData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_size: mediaFile.file_size,
      mime_type: mimeType,
      width: mediaFile.width,
      height: mediaFile.height,
      duration: 'duration' in mediaFile ? mediaFile.duration : null,
      storage_path: uniqueFileName,
      ...(videoMetadata && { video_metadata: videoMetadata })
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
        media_metadata: {
          file_size: mediaFile.file_size,
          mime_type: mimeType,
          width: mediaFile.width,
          height: mediaFile.height,
          duration: 'duration' in mediaFile ? mediaFile.duration : null,
          ...(videoMetadata && { video: videoMetadata })
        },
        ...(productInfo && {
          product_name: productInfo.product_name,
          product_code: productInfo.product_code,
          quantity: productInfo.quantity,
          vendor_uid: productInfo.vendor_uid,
          purchase_date: productInfo.purchase_date,
          notes: productInfo.notes
        })
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    await handleMediaGroup(supabase, message, messageRecord);
    
    return { public_url: publicUrl };
  } catch (error) {
    console.error('Error in processNewMedia:', {
      error: error.message,
      stack: error.stack,
      file_id: mediaFile.file_id
    });
    throw error;
  }
}