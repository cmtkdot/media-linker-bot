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

async function findOriginalMessage(supabase: any, mediaGroupId: string) {
  const { data } = await supabase
    .from('messages')
    .select('id, analyzed_content')
    .eq('media_group_id', mediaGroupId)
    .eq('is_original_caption', true)
    .maybeSingle();
  
  return data;
}

async function createMessageRecord(supabase: any, messageData: MessageData) {
  const { data, error } = await supabase
    .from('messages')
    .upsert(messageData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function queueForProcessing(supabase: any, messageRecord: any) {
  // Only queue messages with media
  if (!['photo', 'video', 'document', 'animation'].includes(messageRecord.message_type)) {
    return;
  }

  const queueData = {
    queue_type: messageRecord.media_group_id ? 'media_group' : 'media',
    message_media_data: {
      message: {
        url: messageRecord.message_url,
        media_group_id: messageRecord.media_group_id,
        caption: messageRecord.caption,
        message_id: messageRecord.message_id,
        chat_id: messageRecord.chat_id,
        date: messageRecord.telegram_data.date
      },
      sender: {
        sender_info: messageRecord.sender_info,
        chat_info: messageRecord.telegram_data.chat
      },
      analysis: {
        analyzed_content: messageRecord.analyzed_content
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        is_original_caption: messageRecord.is_original_caption,
        original_message_id: messageRecord.original_message_id
      }
    },
    status: 'pending',
    correlation_id: messageRecord.correlation_id,
    chat_id: messageRecord.chat_id,
    message_id: messageRecord.message_id
  };

  const { error } = await supabase
    .from('unified_processing_queue')
    .insert([queueData])
    .onConflict(['correlation_id', 'message_id', 'chat_id'])
    .ignore();

  if (error) {
    console.error('Error queueing message:', error);
  }
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

    // Handle media groups and original caption
    let isOriginalCaption = false;
    let originalMessageId = null;

    if (message.media_group_id && message.caption) {
      const existingOriginal = await findOriginalMessage(supabase, message.media_group_id);
      
      if (!existingOriginal) {
        isOriginalCaption = true;
      } else {
        originalMessageId = existingOriginal.id;
        analyzedContent = existingOriginal.analyzed_content;
        
        // Wait briefly to ensure original message exists
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else if (message.caption) {
      isOriginalCaption = true;
    }

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
      original_message_id: originalMessageId,
      analyzed_content: analyzedContent,
      status: 'pending',
      caption: message.caption
    };

    const messageRecord = await createMessageRecord(supabase, messageData);
    await queueForProcessing(supabase, messageRecord);

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