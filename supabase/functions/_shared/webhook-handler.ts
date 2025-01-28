import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TelegramUpdate, TelegramMessage } from './telegram-types.ts';
import { validateMediaFile } from './media-validators.ts';
import { processMediaFile } from './media-processor.ts';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';

export async function handleWebhookUpdate(
  update: TelegramUpdate, 
  supabase: any, 
  correlationId: string,
  botToken: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    return { 
      success: false, 
      message: 'No message in update',
      data: { status: 'error' }
    };
  }

  try {
    console.log('Processing webhook update:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Check for existing messages in the same media group
    let existingGroupMessages = [];
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      existingGroupMessages = groupMessages || [];
      console.log('Found existing group messages:', existingGroupMessages.length);
    }

    // Analyze message content and handle caption inheritance
    const analyzedMessageContent = await analyzeWebhookMessage(message, existingGroupMessages);
    console.log('Message analysis result:', analyzedMessageContent);

    // Build complete message data structure
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedMessageContent);
    console.log('Built message data structure');

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
        analyzed_content: analyzedMessageContent.analyzed_content,
        is_original_caption: analyzedMessageContent.is_original_caption,
        original_message_id: analyzedMessageContent.original_message_id,
        message_media_data: messageData,
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

          // Create telegram_media record
          const { error: mediaError } = await supabase
            .from('telegram_media')
            .insert({
              message_id: messageRecord.id,
              file_id: mediaFile.file_id,
              file_unique_id: mediaFile.file_unique_id,
              file_type: mediaType,
              telegram_data: message,
              correlation_id: correlationId,
              is_original_caption: analyzedMessageContent.is_original_caption,
              original_message_id: analyzedMessageContent.original_message_id,
              message_media_data: messageData
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

function getMediaType(message: TelegramMessage): string | null {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return null;
}