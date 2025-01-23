import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function createMessage(supabase: any, message: any) {
  if (!message?.message_id || !message?.chat?.id) {
    throw new Error('Invalid message data: missing required fields');
  }

  const messageData = {
    message_id: message.message_id,
    chat_id: message.chat.id,
    sender_info: message.from || message.sender_chat || {},
    message_type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'unknown',
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
    const { data, error } = await supabase
      .from('messages')
      .update(messageData)
      .eq('id', existingMessage.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  if (error) throw error;
  return data;
}