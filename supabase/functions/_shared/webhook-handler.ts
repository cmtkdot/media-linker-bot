import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function handleWebhookUpdate(
  update: any, 
  supabase: any, 
  botToken: string,
  correlationId: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  try {
    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption);
        console.log('Caption analyzed:', { 
          message_id: message.message_id,
          analyzed_content: analyzedContent
        });
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Determine if this is an original caption holder
    let isOriginalCaption = false;
    let originalMessageId = null;

    if (message.media_group_id) {
      // For media groups, check for existing caption holder
      const { data: existingOriginal } = await supabase
        .from('messages')
        .select('id, analyzed_content')
        .eq('media_group_id', message.media_group_id)
        .eq('is_original_caption', true)
        .single();

      if (message.caption) {
        if (!existingOriginal) {
          isOriginalCaption = true;
        } else {
          originalMessageId = existingOriginal.id;
          analyzedContent = existingOriginal.analyzed_content;
        }
      } else if (existingOriginal) {
        originalMessageId = existingOriginal.id;
        analyzedContent = existingOriginal.analyzed_content;
      }
    } else if (message.caption) {
      // Single messages with captions are always original
      isOriginalCaption = true;
    }

    // Create basic message record
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      telegram_data: message,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption,
      original_message_id: originalMessageId,
      analyzed_content: analyzedContent,
      status: 'pending',
      caption: message.caption
    };

    // If this is a non-original message in a media group, wait for original
    if (message.media_group_id && !isOriginalCaption && originalMessageId) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Insert message record
    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .upsert(messageData)
        .select()
        .single();
    });

    if (messageError) throw messageError;

    // Queue for processing if needed
    if (messageRecord && (message.photo || message.video || message.document)) {
      const { error: queueError } = await supabase
        .from('unified_processing_queue')
        .insert({
          queue_type: message.media_group_id ? 'media_group' : 'media',
          status: 'pending',
          correlation_id: correlationId,
          chat_id: message.chat.id,
          message_id: message.message_id,
          message_media_data: {
            message: {
              url: messageUrl,
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
              analyzed_content: analyzedContent
            },
            meta: {
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'pending',
              is_original_caption: isOriginalCaption,
              original_message_id: originalMessageId
            }
          }
        })
        .onConflict(['correlation_id', 'message_id', 'chat_id'])
        .ignore();

      if (queueError) {
        console.error('Error queueing message:', queueError);
      }
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId,
      isOriginalCaption
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}