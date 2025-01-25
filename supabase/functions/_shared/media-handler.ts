import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';
import { downloadFile } from './file-handler.ts';
import { getMimeType } from './media-validators.ts';
import { handleMediaGroup } from './media-group-handler.ts';

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
    has_message_record: !!messageRecord
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

      // Use file unique ID for naming
      const uniqueId = mediaFile.file_unique_id;
      mediaFile = { ...mediaFile, customFileName: uniqueId };

      // Check for existing media
      const { data: existingMediaRecord } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();

      if (existingMediaRecord) {
        console.log('Found existing media:', existingMediaRecord.id);
        return existingMediaRecord;
      }

      // Download and process the file
      const { buffer, filePath } = await downloadFile(mediaFile.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${uniqueId}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, buffer, {
          contentType: getMimeType(filePath),
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Create media record
      const { data: mediaRecord, error: insertError } = await supabase
        .from('telegram_media')
        .insert([{
          file_id: mediaFile.file_id,
          file_unique_id: mediaFile.file_unique_id,
          file_type: mediaType,
          message_id: messageRecord?.id,
          public_url: publicUrl,
          storage_path: fileName,
          telegram_data: message,
          message_media_data: {
            message: {
              url: `https://t.me/c/${message.chat.id.toString().substring(4)}/${message.message_id}`,
              media_group_id: message.media_group_id,
              caption: message.caption,
              message_id: message.message_id,
              chat_id: message.chat.id,
              date: message.date
            },
            sender: {
              sender_info: message.from || message.sender_chat || {},
              chat_info: message.chat || {}
            },
            analysis: {
              analyzed_content: productInfo?.analyzed_content || {}
            },
            meta: {
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'pending',
              error: null
            },
            media: {
              file_id: mediaFile.file_id,
              file_unique_id: mediaFile.file_unique_id,
              file_type: mediaType,
              public_url: publicUrl,
              storage_path: fileName
            }
          }
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      if (message.media_group_id) {
        await handleMediaGroup(supabase, message, messageRecord);
      }

      return mediaRecord;

    } catch (error) {
      console.error('Error in processMedia:', {
        error: error.message,
        retry_count: retryCount
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

      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}