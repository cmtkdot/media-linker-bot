import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { delay } from './retry-utils.ts';

export async function processMessageBatch(messages: any[], supabase: any) {
  console.log('Processing message batch:', messages.length);
  
  for (const message of messages) {
    try {
      const messageData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: getMessageType(message),
        message_data: message,
        caption: message.caption,
        media_group_id: message.media_group_id,
        status: 'pending'
      };

      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .maybeSingle();

      if (existingMessage) {
        await supabase
          .from('messages')
          .update(messageData)
          .eq('id', existingMessage.id);
      } else {
        await supabase
          .from('messages')
          .insert(messageData);
      }

      // Add delay between messages
      await delay(500);
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }
}

function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}