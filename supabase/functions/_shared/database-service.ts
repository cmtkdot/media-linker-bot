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
            contentType: getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = await supabase.storage
          .from('media')
          .getPublicUrl(uniqueFileName);

        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
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
          })
          .eq('id', existingMedia.id);

        if (updateError) throw updateError;
        result = existingMedia;
      } else {
        console.log('[Media Processing] Processing new media');
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
            contentType: getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
            upsert: false
          });

        if (uploadError) throw uploadError;

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

        const { data: newMedia, error: insertError } = await supabase
          .from('telegram_media')
          .insert(mediaRecord)
          .select()
          .single();

        if (insertError) throw insertError;
        result = newMedia;
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