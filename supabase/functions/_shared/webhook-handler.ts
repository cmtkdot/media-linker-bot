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
      has_caption: !!message.caption,
      message_type: determineMessageType(message)
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
        existing_id: existingMessage.id,
        has_analyzed_content: !!existingMessage.analyzed_content
      });
      return {
        success: true,
        message: 'Message already exists',
        messageId: existingMessage.id
      };
    }

    // Get existing group messages if part of media group
    let existingGroupMessages;
    let mediaGroupSize = 0;
    
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, message_type, media_group_size')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      existingGroupMessages = groupMessages;
      
      // Calculate media group size
      if (groupMessages?.[0]?.media_group_size) {
        mediaGroupSize = groupMessages[0].media_group_size;
      } else {
        // Count media items in the message
        if (message.photo) mediaGroupSize += 1;
        if (message.video) mediaGroupSize += 1;
        if (message.document) mediaGroupSize += 1;
        if (message.animation) mediaGroupSize += 1;
        mediaGroupSize = Math.max(mediaGroupSize, 1);
      }
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
        media_group_size: mediaGroupSize,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        message_media_data: messageData,
        last_group_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    // Queue for processing if media type
    if (messageType === 'photo' || messageType === 'video') {
      let shouldQueue = true;
      let shouldMarkProcessed = false;

      if (message.media_group_id) {
        // Count current group messages
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .eq('media_group_id', message.media_group_id);

        shouldQueue = count >= mediaGroupSize;
        shouldMarkProcessed = shouldQueue;
      } else {
        shouldMarkProcessed = true;
      }

      if (shouldMarkProcessed) {
        const updateQuery = message.media_group_id
          ? supabase
              .from('messages')
              .update({
                status: 'processed',
                processed_at: new Date().toISOString()
              })
              .eq('media_group_id', message.media_group_id)
          : supabase
              .from('messages')
              .update({
                status: 'processed',
                processed_at: new Date().toISOString()
              })
              .eq('id', messageRecord.id);

        const { error: updateError } = await updateQuery;
        if (updateError) {
          console.error('Error updating message status:', updateError);
        }
      }

      if (shouldQueue) {
        console.log('Queueing for processing:', {
          message_id: message.message_id,
          media_group_id: message.media_group_id,
          items_count: message.media_group_id ? mediaGroupSize : 1
        });
        await queueWebhookMessage(supabase, messageData, correlationId, messageType);
      } else {
        console.log('Waiting for more media group items before queueing:', {
          media_group_id: message.media_group_id,
          current_count: count,
          expected_size: mediaGroupSize
        });
      }
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