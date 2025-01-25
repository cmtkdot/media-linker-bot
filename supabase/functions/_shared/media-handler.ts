import { processMediaFile } from './database-service.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';
import { supabase } from './supabase.ts';
import { downloadFile } from './file-handler.ts';

export async function processMedia(
  supabase: any,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any,
  retryCount: number,
  existingMedia: any = null
) {
  console.log('Starting media processing:', {
    message_id: message?.message_id,
    chat_id: message?.chat?.id,
    retry_count: retryCount,
    has_existing_media: !!existingMedia,
    has_message_record: !!messageRecord,
    product_info: productInfo
  });

  while (retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      // Determine media type and file
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

      // Simplified file naming - just use the unique ID
      const uniqueId = mediaFile.file_unique_id;
      
      // Update mediaFile with new naming convention
      mediaFile = {
        ...mediaFile,
        customFileName: uniqueId
      };

      console.log('Processing media file:', {
        type: mediaType,
        file_id: mediaFile.file_id,
        message_id: messageRecord?.id,
        custom_file_name: uniqueId
      });

      // Check for existing media first
      const { data: existingMediaRecord } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();

      if (existingMediaRecord) {
        console.log('Found existing media record:', {
          id: existingMediaRecord.id,
          file_unique_id: existingMediaRecord.file_unique_id
        });

        // Update existing record with new message_id if available
        if (messageRecord?.id && !existingMediaRecord.message_id) {
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({ message_id: messageRecord.id })
            .eq('id', existingMediaRecord.id);

          if (updateError) {
            console.error('Error updating message_id:', updateError);
          }
        }

        return existingMediaRecord;
      }

      // Process the media file even without message_id
      const result = await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord || null,
        botToken,
        {
          ...productInfo,
        }
      );

      console.log('Media processing completed successfully:', {
        file_id: mediaFile.file_id,
        media_type: mediaType,
        result_id: result?.id,
        has_message_id: !!messageRecord,
      });

      return result;

    } catch (error) {
      console.error('Error in processMedia:', {
        error: error.message,
        retry_count: retryCount,
        message_id: messageRecord?.id
      });

      retryCount++;
      
      if (messageRecord) {
        const errorResult = await handleProcessingError(
          supabase, 
          error, 
          messageRecord, 
          retryCount,
          retryCount >= MAX_RETRY_ATTEMPTS
        );

        if (!errorResult.shouldContinue) {
          throw error;
        }
      } else if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      // Add delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}

export async function processMediaMessage(message: any) {
  try {
    const mediaType = getMediaType(message);
    if (!mediaType) return null;

    const mediaData = message[mediaType];
    if (!mediaData) return null;

    const fileId = mediaData.file_id;
    const fileUniqueId = mediaData.file_unique_id;

    console.log('Processing media:', {
      type: mediaType,
      fileId,
      fileUniqueId
    });

    // Download the media file
    const { fileName, fileData } = await downloadFile(fileId);
    if (!fileData) {
      console.error('Failed to download media file');
      return null;
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('media')
      .upload(fileName, fileData, {
        contentType: getContentType(fileName)
      });

    if (uploadError) {
      console.error('Error uploading media:', uploadError);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('media')
      .getPublicUrl(fileName);

    console.log('Media uploaded successfully:', publicUrl);

    // Return media data
    return {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: mediaType,
      public_url: publicUrl,
      media_metadata: {
        file_name: fileName,
        content_type: getContentType(fileName),
        size: fileData.length
      }
    };

  } catch (error) {
    console.error('Error processing media:', error);
    return null;
  }
}

function getMediaType(message: any): string | null {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  return null;
}

function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}