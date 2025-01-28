import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WebhookUpdate, WebhookResponse, WebhookMessageData } from './telegram-types.ts';
import { validateMediaFile, getMediaType } from './media-validators.ts';
import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { uploadMediaToStorage } from './storage-manager.ts';

export async function handleWebhookUpdate(
  update: WebhookUpdate, 
  supabase: any, 
  correlationId: string,
  botToken: string
): Promise<WebhookResponse> {
  const message = update.message || update.channel_post;
  if (!message) {
    return { 
      success: false, 
      message: 'No message in update',
      data: {
        telegram_data: message,
        status: 'error'
      }
    };
  }

  try {
    console.log('Processing webhook update:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, is_original_caption, analyzed_content')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log('Message already exists:', {
        message_id: message.message_id,
        existing_id: existingMessage.id
      });
      return {
        success: true,
        message: 'Message already exists',
        messageId: existingMessage.id,
        data: {
          telegram_data: message,
          status: 'processed'
        }
      };
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Create message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: getMediaType(message) || 'text',
        telegram_data: message,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        status: 'pending'
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    // Process media if present
    const mediaType = getMediaType(message);
    if (mediaType) {
      const mediaFile = message.photo?.[0] || message.video || message.document || message.animation;
      
      if (mediaFile) {
        try {
          // Validate media file
          await validateMediaFile(mediaFile, mediaType);

          // Download and upload to storage
          const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
          const { publicUrl } = await uploadMediaToStorage(supabase, buffer, mediaFile.file_unique_id, mediaType);

          // Create telegram_media record
          const { error: mediaError } = await supabase
            .from('telegram_media')
            .insert({
              message_id: messageRecord.id,
              file_id: mediaFile.file_id,
              file_unique_id: mediaFile.file_unique_id,
              file_type: mediaType,
              public_url: publicUrl,
              telegram_data: message,
              correlation_id: correlationId
            });

          if (mediaError) {
            throw mediaError;
          }
        } catch (error) {
          console.error('Error processing media:', error);
          await supabase
            .from('messages')
            .update({
              processing_error: error.message,
              status: 'error'
            })
            .eq('id', messageRecord.id);

          throw error;
        }
      }
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      data: {
        telegram_data: message,
        status: 'processed'
      }
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return {
      success: false,
      message: error.message,
      data: {
        telegram_data: message,
        status: 'error'
      }
    };
  }
}