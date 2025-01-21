import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';
import { syncMediaGroupCaptions, getMediaGroupInfo } from './media-group-manager.ts';

export async function createMessage(supabase: any, message: any, productInfo: any = null) {
  if (!message?.message_id || !message?.chat?.id) {
    console.error('[Message] Invalid data:', { message });
    throw new Error('Invalid message data: missing required fields');
  }

  console.log('[Message] Creating:', { 
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

    const { data: upsertedMessage, error: upsertError } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'message_id,chat_id',
        returning: 'representation'
      })
      .select()
      .maybeSingle();

    if (upsertError) throw upsertError;

    // If this is part of a media group and has caption/product info, sync it
    if (message.media_group_id && (message.caption || productInfo)) {
      await syncMediaGroupCaptions(
        supabase,
        message.media_group_id,
        productInfo,
        message.caption
      );
    }

    return upsertedMessage;
  } catch (error) {
    console.error('[Message] Creation error:', error);
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

      // Find the media file in the message
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

      console.log('[Media] Processing:', {
        file_id: mediaFile.file_id,
        type: mediaType,
        retry_count: retryCount,
        media_group_id: message.media_group_id
      });

      // Check for existing media
      const { data: existingMedia, error: queryError } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();

      if (queryError) throw queryError;

      // If part of a media group, get group info before processing
      if (message.media_group_id) {
        const groupMedia = await getMediaGroupInfo(supabase, message.media_group_id);
        if (groupMedia.length > 0) {
          // Use the most complete item's info if available
          const mostCompleteItem = groupMedia.reduce((prev, current) => {
            const prevScore = (prev.caption ? 1 : 0) + (prev.analyzed_content ? 1 : 0);
            const currentScore = (current.caption ? 1 : 0) + (current.analyzed_content ? 1 : 0);
            return currentScore > prevScore ? current : prev;
          });

          productInfo = {
            ...productInfo,
            caption: mostCompleteItem.caption || productInfo?.caption,
            product_name: mostCompleteItem.product_name || productInfo?.product_name,
            product_code: mostCompleteItem.product_code || productInfo?.product_code,
            quantity: mostCompleteItem.quantity || productInfo?.quantity,
            vendor_uid: mostCompleteItem.vendor_uid || productInfo?.vendor_uid,
            purchase_date: mostCompleteItem.purchase_date || productInfo?.purchase_date,
            notes: mostCompleteItem.notes || productInfo?.notes,
            analyzed_content: mostCompleteItem.analyzed_content || productInfo?.analyzed_content
          };
        }
      }

      let result;
      if (existingMedia) {
        // Update existing media
        const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
        const fileExt = filePath.split('.').pop() || '';
        const uniqueFileName = generateSafeFileName(
          productInfo?.product_name,
          productInfo?.product_code,
          mediaType,
          fileExt,
          message.media_group_id
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

        const { data: updatedMedia, error: updateError } = await supabase
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
          .eq('id', existingMedia.id)
          .select()
          .single();

        if (updateError) throw updateError;
        result = updatedMedia;
      } else {
        // Process new media
        const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
        const fileExt = filePath.split('.').pop() || '';
        const uniqueFileName = generateSafeFileName(
          productInfo?.product_name,
          productInfo?.product_code,
          mediaType,
          fileExt,
          message.media_group_id
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

      // After processing, sync media group if needed
      if (message.media_group_id && (message.caption || productInfo)) {
        await syncMediaGroupCaptions(
          supabase,
          message.media_group_id,
          productInfo,
          message.caption
        );
      }

      return result;

    } catch (error) {
      retryCount++;
      await handleProcessingError(supabase, error, messageRecord, retryCount);
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}