import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';
import { queueWebhookMessage } from './webhook-queue-manager.ts';

function determineMessageType(message: any): string {
  if (message.text && !message.photo && !message.video && !message.document && !message.animation) return 'text';
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
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
        messageId: existingMessage.id
      };
    }

    // Get existing group messages if part of media group
    let existingGroupMessages;
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      existingGroupMessages = groupMessages;
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    
    // Analyze message content
    const messageType = determineMessageType(message);
    const analyzedContent = await analyzeWebhookMessage(message, existingGroupMessages);
    
    // Build message data structure
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    // Create message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: messageType,
        telegram_data: message,
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        message_media_data: messageData
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Queue message for processing if it's a media message
    if (messageType === 'photo' || messageType === 'video') {
      await queueWebhookMessage(supabase, messageData, correlationId, messageType);
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId: correlationId
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}