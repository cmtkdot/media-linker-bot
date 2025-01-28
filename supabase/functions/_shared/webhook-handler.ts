import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';

interface MessageData {
  message_id: number;
  chat_id: number;
  sender_info: Record<string, any>;
  message_type: string;
  telegram_data: Record<string, any>;
  media_group_id?: string;
  message_url: string;
  correlation_id: string;
  is_original_caption: boolean;
  original_message_id?: string;
  analyzed_content?: Record<string, any>;
  caption?: string;
}

export async function handleWebhookUpdate(
  update: any, 
  supabase: any,
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

    // Determine if this is an original caption message
    const isOriginalCaption = !!message.caption;

    // Create message record
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
      analyzed_content: analyzedContent,
      status: 'pending',
      caption: message.caption,
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
          chat_info: message.chat
        },
        analysis: {
          analyzed_content: analyzedContent
        },
        meta: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'pending',
          error: null,
          is_original_caption: isOriginalCaption,
          correlation_id: correlationId
        }
      }
    };

    console.log('Creating message record:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption,
      media_group_id: message.media_group_id
    });

    // Insert message record with conflict handling
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'message_id, chat_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      throw messageError;
    }

    // Queue for processing with conflict handling
    const { error: queueError } = await supabase
      .from('unified_processing_queue')
      .upsert({
        queue_type: message.media_group_id ? 'media_group' : 'media',
        message_media_data: messageData.message_media_data,
        status: 'pending',
        correlation_id: correlationId,
        chat_id: message.chat.id,
        message_id: message.message_id
      }, {
        onConflict: 'correlation_id, message_id, chat_id',
        ignoreDuplicates: true
      });

    if (queueError) {
      console.error('Error queueing message:', queueError);
      throw queueError;
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId,
      isOriginalCaption,
      status: 'pending'
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