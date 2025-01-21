import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

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
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing message:', checkError);
      throw checkError;
    }

    if (existingMessage) {
      console.log('Updating existing message:', existingMessage.id);
      const { data: updatedMessage, error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating message:', updateError);
        throw updateError;
      }
      return updatedMessage;
    }

    console.log('Creating new message with data:', messageData);
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating message:', insertError);
      throw insertError;
    }

    if (!newMessage) {
      throw new Error('Failed to create message record: no data returned');
    }

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

    // Determine proper MIME type
    let mimeType = mediaFile.mime_type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (mediaType === 'photo') {
        mimeType = 'image/jpeg';
      } else {
        mimeType = getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream');
      }
    }

    console.log('Using MIME type for upload:', mimeType);

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

export async function updateExistingMedia(
  supabase: any,
  mediaFile: any,
  message: any,
  messageRecord: any,
  productInfo: any = null
) {
  console.log('[Database] Updating existing media:', {
    file_unique_id: mediaFile.file_unique_id,
    message_id: message.message_id
  });

  try {
    const { data: existingMedia, error: mediaFetchError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .single();

    if (mediaFetchError) throw mediaFetchError;

    const telegramData = {
      ...existingMedia.telegram_data,
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id
    };

    const { error: mediaError } = await supabase
      .from('telegram_media')
      .update({
        telegram_data: telegramData,
        caption: message.caption,
        ...(productInfo && {
          product_name: productInfo.product_name,
          product_code: productInfo.product_code,
          quantity: productInfo.quantity,
          vendor_uid: productInfo.vendor_uid,
          purchase_date: productInfo.purchase_date,
          notes: productInfo.notes,
          analyzed_content: productInfo
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMedia.id);

    if (mediaError) throw mediaError;

    return existingMedia;
  } catch (error) {
    console.error('[Database] Error updating media:', error);
    throw error;
  }
}

export async function syncMediaGroupInfo(
  supabase: any,
  message: any,
  messageRecord: any
) {
  if (!message.media_group_id) {
    console.log('[Media Group] No media group ID, skipping sync');
    return;
  }

  console.log('[Media Group] Starting sync:', {
    media_group_id: message.media_group_id,
    message_id: message.message_id
  });

  try {
    // Get all media in this group
    const { data: groupMedia, error: mediaError } = await supabase
      .from('telegram_media')
      .select('*')
      .filter('telegram_data->media_group_id', 'eq', message.media_group_id)
      .order('created_at', { ascending: false });

    if (mediaError) throw mediaError;

    if (!groupMedia?.length) {
      console.log('[Media Group] No existing media to sync');
      return;
    }

    // Get the latest non-null values
    const latestValues = groupMedia.reduce((acc, media) => ({
      caption: acc.caption || media.caption,
      product_name: acc.product_name || media.product_name,
      product_code: acc.product_code || media.product_code,
      quantity: acc.quantity || media.quantity,
      vendor_uid: acc.vendor_uid || media.vendor_uid,
      purchase_date: acc.purchase_date || media.purchase_date,
      notes: acc.notes || media.notes,
      analyzed_content: acc.analyzed_content || media.analyzed_content
    }), {
      caption: messageRecord.caption,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date,
      notes: messageRecord.notes,
      analyzed_content: messageRecord.analyzed_content
    });

    // Update all media in the group
    const { error: updateError } = await supabase
      .from('telegram_media')
      .update({
        caption: latestValues.caption,
        product_name: latestValues.product_name,
        product_code: latestValues.product_code,
        quantity: latestValues.quantity,
        vendor_uid: latestValues.vendor_uid,
        purchase_date: latestValues.purchase_date,
        notes: latestValues.notes,
        analyzed_content: latestValues.analyzed_content,
        updated_at: new Date().toISOString()
      })
      .filter('telegram_data->media_group_id', 'eq', message.media_group_id);

    if (updateError) throw updateError;

    console.log('[Media Group] Sync completed:', {
      media_group_id: message.media_group_id,
      updated_count: groupMedia.length
    });
  } catch (error) {
    console.error('[Media Group] Sync error:', error);
    throw error;
  }
}

export async function processMedia(
  supabase: any,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null,
  retryCount = 0
) {
  while (retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      for (const type of mediaTypes) {
        if (message[type]) {
          mediaFile = type === 'photo' 
            ? message[type][message[type].length - 1] 
            : message[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaFile) {
        throw new Error('No media file found in message');
      }

      console.log('[Media Processing] Starting:', {
        file_id: mediaFile.file_id,
        type: mediaType,
        retry_count: retryCount
      });

      // Check for existing media
      const { data: existingMedia } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .single();

      let result;
      if (existingMedia) {
        console.log('[Media Processing] Updating existing media:', existingMedia.id);
        result = await updateExistingMedia(supabase, mediaFile, message, messageRecord, productInfo);
      } else {
        console.log('[Media Processing] Processing new media');
        result = await processMediaFile(supabase, mediaFile, mediaType, message, messageRecord, botToken, productInfo);
      }

      // Sync media group info after processing
      if (message.media_group_id) {
        await syncMediaGroupInfo(supabase, message, messageRecord);
      }

      return result;

    } catch (error) {
      retryCount++;
      await handleProcessingError(supabase, error, messageRecord, retryCount);
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}
