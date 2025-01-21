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

    const { data: upsertedMessage, error: upsertError } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'message_id,chat_id',
        returning: 'representation'
      })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error('Error upserting message:', upsertError);
      throw upsertError;
    }

    return upsertedMessage;
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
        retry_count: retryCount,
        media_group_id: message.media_group_id
      });

      const { data: existingMedia, error: queryError } = await Promise.race([
        supabase
          .from('telegram_media')
          .select('*')
          .eq('file_unique_id', mediaFile.file_unique_id)
          .maybeSingle(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 15000)
        )
      ]);

      if (queryError) throw queryError;

      if (message.media_group_id) {
        console.log('[Media Group] Syncing captions for group:', message.media_group_id);
        const { data: groupMedia, error: groupError } = await supabase
          .from('telegram_media')
          .select('*')
          .eq('telegram_data->>media_group_id', message.media_group_id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!groupError && groupMedia?.length > 0) {
          const latestGroupItem = groupMedia[0];
          productInfo = {
            ...productInfo,
            caption: latestGroupItem.caption || productInfo?.caption,
            product_name: latestGroupItem.product_name || productInfo?.product_name,
            product_code: latestGroupItem.product_code || productInfo?.product_code,
            quantity: latestGroupItem.quantity || productInfo?.quantity,
            vendor_uid: latestGroupItem.vendor_uid || productInfo?.vendor_uid,
            purchase_date: latestGroupItem.purchase_date || productInfo?.purchase_date,
            notes: latestGroupItem.notes || productInfo?.notes
          };
        }
      }

      let result;
      if (existingMedia) {
        console.log('[Media Processing] Updating existing media:', existingMedia.id);
        const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
        const fileExt = filePath.split('.').pop() || '';
        const uniqueFileName = generateSafeFileName(
          productInfo?.product_name,
          productInfo?.product_code,
          mediaType,
          fileExt,
          message.media_group_id
        );

        const uploadPromise = supabase.storage
          .from('media')
          .upload(uniqueFileName, buffer, {
            contentType: getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
            upsert: true
          });

        const { data: uploadData, error: uploadError } = await Promise.race([
          uploadPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout')), 30000)
          )
        ]);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = await supabase.storage
          .from('media')
          .getPublicUrl(uniqueFileName);

        const updatePromise = supabase
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

        const { data: updatedMedia, error: updateError } = await Promise.race([
          updatePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Update timeout')), 15000)
          )
        ]);

        if (updateError) throw updateError;
        result = updatedMedia;
      } else {
        console.log('[Media Processing] Processing new media');
        const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
        const fileExt = filePath.split('.').pop() || '';
        const uniqueFileName = generateSafeFileName(
          productInfo?.product_name,
          productInfo?.product_code,
          mediaType,
          fileExt,
          message.media_group_id
        );

        const uploadPromise = supabase.storage
          .from('media')
          .upload(uniqueFileName, buffer, {
            contentType: getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
            upsert: false
          });

        const { data: uploadData, error: uploadError } = await Promise.race([
          uploadPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout')), 30000)
          )
        ]);

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

        const insertPromise = supabase
          .from('telegram_media')
          .insert(mediaRecord)
          .select()
          .single();

        const { data: newMedia, error: insertError } = await Promise.race([
          insertPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Insert timeout')), 15000)
          )
        ]);

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

      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}
