import { validateMediaFile, getMediaType, getMimeType } from './media-validators.ts';
import { ensureStorageBucket, uploadMediaToStorage } from './storage-manager.ts';
import { getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { handleMediaGroup } from './media-group-handler.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';

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
    media_group_id: message.media_group_id
  });

  try {
    // Validate media file
    await validateMediaFile(mediaFile, mediaType);
    
    // Ensure storage bucket exists
    await ensureStorageBucket(supabase);

    // Analyze caption if present but no product info
    if (message.caption && !productInfo) {
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', productInfo);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Download file from Telegram
    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    const fileExt = filePath.split('.').pop()?.toLowerCase() || '';
    
    // Generate unique filename
    const uniqueFileName = generateSafeFileName(
      productInfo?.product_name || 'untitled',
      productInfo?.product_code || 'no_code',
      mediaType,
      fileExt
    );

    // Determine MIME type
    const mimeType = getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'video/mp4');
    
    // Upload to storage
    const { publicUrl } = await uploadMediaToStorage(supabase, buffer, uniqueFileName, mimeType);

    // Create media record
    const mediaRecord = {
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: mediaType,
      message_id: messageRecord.id,
      public_url: publicUrl,
      telegram_data: {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_chat: message.sender_chat,
        chat: message.chat,
        date: message.date,
        caption: message.caption,
        media_group_id: message.media_group_id,
        storage_path: uniqueFileName
      },
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

    if (dbError) {
      console.error('Error creating media record:', dbError);
      throw new Error(`Failed to create media record: ${dbError.message}`);
    }

    // Handle media group synchronization
    if (message.media_group_id) {
      await handleMediaGroup(supabase, message, messageRecord);
    }

    return { public_url: publicUrl };
  } catch (error) {
    console.error('Error in processNewMedia:', error);
    throw error;
  }
}

export async function processMedia(
  supabase: any,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null
) {
  const mediaType = getMediaType(message);
  if (!mediaType) {
    throw new Error('Invalid media type in message');
  }

  const mediaFile = mediaType === 'photo' 
    ? message.photo[message.photo.length - 1] 
    : message[mediaType];

  if (!mediaFile) {
    throw new Error('No media file found in message');
  }

  console.log('Processing media:', {
    file_id: mediaFile.file_id,
    type: mediaType,
    media_group_id: message.media_group_id
  });

  // Check for existing media
  const { data: existingMedia } = await supabase
    .from('telegram_media')
    .select('*')
    .eq('file_unique_id', mediaFile.file_unique_id)
    .single();

  if (existingMedia) {
    console.log('Updating existing media:', existingMedia.id);
    
    const { error: updateError } = await supabase
      .from('telegram_media')
      .update({
        caption: message.caption || existingMedia.caption,
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

    if (updateError) {
      console.error('Error updating existing media:', updateError);
      throw updateError;
    }

    return existingMedia;
  }

  return await processNewMedia(
    supabase,
    mediaFile,
    mediaType,
    message,
    messageRecord,
    botToken,
    productInfo
  );
}