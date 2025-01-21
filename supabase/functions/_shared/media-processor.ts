import { validateMediaFile, getMediaType, getMimeType } from './media-validators.ts';
import { ensureStorageBucket, uploadMediaToStorage } from './storage-manager.ts';
import { updateExistingMedia, createNewMediaRecord } from './media-database.ts';
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
  console.log(`Processing new ${mediaType} file:`, mediaFile.file_id);

  try {
    await validateMediaFile(mediaFile, mediaType);
    await ensureStorageBucket(supabase);

    if (message.caption && !productInfo) {
      productInfo = await analyzeCaptionWithAI(
        message.caption,
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );
    }

    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
    const fileExt = filePath.split('.').pop()?.toLowerCase() || '';
    const mimeType = getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'video/mp4');
    
    const uniqueFileName = generateSafeFileName(
      productInfo?.product_name || 'untitled',
      productInfo?.product_code || 'no_code',
      mediaType,
      fileExt
    );

    const { publicUrl } = await uploadMediaToStorage(supabase, buffer, uniqueFileName, mimeType);
    
    await createNewMediaRecord(
      supabase,
      mediaFile,
      mediaType,
      message,
      messageRecord,
      publicUrl,
      uniqueFileName,
      productInfo
    );

    await handleMediaGroup(supabase, message, messageRecord);
    
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
  const mediaFile = mediaType === 'photo' 
    ? message.photo[message.photo.length - 1] 
    : message[mediaType];

  if (!mediaFile) {
    throw new Error('No media file found in message');
  }

  console.log('Processing media file:', {
    file_id: mediaFile.file_id,
    type: mediaType
  });

  const { data: existingMedia } = await supabase
    .from('telegram_media')
    .select('*')
    .eq('file_unique_id', mediaFile.file_unique_id)
    .single();

  if (existingMedia) {
    return await updateExistingMedia(supabase, mediaFile, message, messageRecord, productInfo);
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