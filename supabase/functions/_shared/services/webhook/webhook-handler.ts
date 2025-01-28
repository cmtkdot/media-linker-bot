import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WebhookUpdate, WebhookResponse } from '../../types/telegram.types';
import { analyzeCaption } from '../caption/caption-analyzer';
import { buildMessageData } from './message-builder';
import { queueMessage } from '../queue/queue-manager';

export async function handleWebhookUpdate(
  supabase: any,
  update: WebhookUpdate,
  correlationId: string
): Promise<WebhookResponse> {
  const message = update.message || update.channel_post;
  
  if (!message) {
    console.log('No message in update');
    return { success: false, message: 'No message found in update' };
  }

  try {
    console.log('Processing webhook update:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id
    });

    // Build initial message data
    const messageData = await buildMessageData(message, correlationId);
    
    // Analyze caption if present
    if (message.caption) {
      const analysis = await analyzeCaption(message.caption);
      messageData.analysis.analyzed_content = analysis;
    }

    // Insert into messages table
    const { data: messageRecord, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;

    // Queue for processing if media message
    if (message.photo || message.video) {
      await queueMessage(supabase, messageRecord, correlationId);
    }

    return {
      success: true,
      message: 'Message processed successfully',
      messageId: messageRecord.id,
      data: {
        analyzed_content: messageRecord.analyzed_content,
        telegram_data: messageRecord.telegram_data,
        status: messageRecord.status
      }
    };
  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}