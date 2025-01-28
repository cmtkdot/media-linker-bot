import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MessageMediaData } from '../../types/message.types';
import { analyzeCaption } from '../caption/caption.service';
import { buildMessageData } from './message-builder.service';

export async function processWebhookUpdate(
  supabase: any,
  update: any,
  correlationId: string
): Promise<{ success: boolean; messageId: string }> {
  const message = update.message || update.channel_post;
  
  if (!message) {
    console.log('No message in update');
    return { success: false, messageId: '' };
  }

  try {
    // Create message record
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
      await queueForProcessing(supabase, messageRecord, correlationId);
    }

    return { success: true, messageId: messageRecord.id };
  } catch (error) {
    console.error('Error in webhook service:', error);
    throw error;
  }
}