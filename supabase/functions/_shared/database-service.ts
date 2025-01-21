import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageType, getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';

export async function createMessage(supabase: any, message: any, productInfo: any = null) {
  console.log('Creating message:', { 
    message_id: message.message_id, 
    chat_id: message.chat.id,
    product_info: productInfo 
  });

  try {
    // First check for existing message
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
        analyzed_content: productInfo // Store the complete analyzed content
      })
    };

    // If message exists, update it
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

      if (!updatedMessage) {
        console.error('No data returned after update');
        throw new Error('Message update failed - no data returned');
      }

      console.log('Successfully updated message:', updatedMessage.id);
      return updatedMessage;
    }

    // If no existing message, create new one
    console.log('Creating new message with data:', messageData);
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    if (!newMessage) {
      console.error('No data returned after insert');
      throw new Error('Message creation failed - no data returned');
    }

    console.log('Successfully created message:', newMessage.id);
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
    // Check for existing media to prevent duplicates
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, public_url')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .eq('telegram_data->chat_id', message.chat.id)
      .eq('telegram_data->message_id', message.message_id)
      .maybeSingle();

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
        quantity: productInfo.quantity ? BigInt(productInfo.quantity).toString() : null,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes,
        analyzed_content: productInfo // Store the complete analyzed content
      })
    };

    console.log('Inserting media record:', {
      file_id: mediaFile.file_id,
      message_id: messageRecord?.id
    });

    const { data: mediaData, error: dbError } = await supabase
      .from('telegram_media')
      .insert(mediaRecord)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    if (!mediaData) {
      throw new Error('Media record creation failed - no data returned');
    }

    console.log(`Successfully processed ${mediaType} file:`, mediaData.id);
    return mediaData;
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}