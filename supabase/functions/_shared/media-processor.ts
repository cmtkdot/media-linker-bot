import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';

export async function processMediaFile(
  supabase: any,
  mediaFile: any,
  mediaType: string,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null
) {
  console.log(`Processing ${mediaType} file:`, mediaFile.file_id);

  try {
    // Check for existing media to prevent duplicates - using file_unique_id which is guaranteed unique by Telegram
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, public_url, file_unique_id')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .single();

    if (existingMedia?.public_url) {
      console.log('Media already exists:', existingMedia);
      return existingMedia;
    }

    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    
    // Generate a unique filename using media type and file_unique_id
    let fileExt = filePath.split('.').pop() || '';
    if (mediaType === 'photo' && !fileExt) {
      fileExt = 'jpg';
    }

    // Create a unique filename pattern
    const uniqueFileName = generateSafeFileName(
      `${mediaType}_${mediaFile.file_unique_id}`,
      fileExt
    );

    console.log('Uploading file:', uniqueFileName);

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

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(uniqueFileName, buffer, {
        contentType: mediaFile.mime_type || (mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
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

    // Prepare telegram data with proper caption handling for media groups
    const telegramData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption || (message.media_group_id ? messageRecord.caption : null),
      media_group_id: message.media_group_id,
      file_size: mediaFile.file_size ? BigInt(mediaFile.file_size).toString() : null,
      mime_type: mediaFile.mime_type || (mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream'),
      width: mediaFile.width ? BigInt(mediaFile.width).toString() : null,
      height: mediaFile.height ? BigInt(mediaFile.height).toString() : null,
      duration: 'duration' in mediaFile ? BigInt(mediaFile.duration).toString() : null,
      storage_path: uniqueFileName
    };

    // For media groups, use the caption from the message record if available
    const captionToUse = message.media_group_id ? messageRecord.caption : message.caption;
    const productInfoToUse = message.media_group_id ? {
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity
    } : productInfo;

    console.log('Inserting media record with data:', {
      file_id: mediaFile.file_id,
      file_type: mediaType,
      public_url: publicUrl,
      message_id: messageRecord.id,
      caption: captionToUse,
      productInfo: productInfoToUse
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
        caption: captionToUse,
        ...(productInfoToUse && {
          product_name: productInfoToUse.product_name,
          product_code: productInfoToUse.product_code,
          quantity: productInfoToUse.quantity ? BigInt(productInfoToUse.quantity).toString() : null
        })
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    console.log(`Successfully processed ${mediaType} file:`, uniqueFileName);
    return { public_url: publicUrl };
  } catch (error) {
    console.error(`Error processing ${mediaType} file:`, error);
    throw error;
  }
}