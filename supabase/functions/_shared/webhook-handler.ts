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
    let mediaGroupSize = null;
    
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, message_type, media_group_size')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      existingGroupMessages = groupMessages;
      
      // Try to determine media group size
      if (message.media_group_size) {
        mediaGroupSize = message.media_group_size;
      } else if (groupMessages?.[0]?.media_group_size) {
        mediaGroupSize = groupMessages[0].media_group_size;
      } else {
        // Estimate size from Telegram's media array
        mediaGroupSize = message.photo?.length || 
                        (message.video ? 1 : 0) || 
                        (message.document ? 1 : 0) || 
                        1;
      }

      console.log('Found existing group messages:', {
        media_group_id: message.media_group_id,
        message_count: groupMessages?.length,
        media_group_size: mediaGroupSize,
        messages: groupMessages?.map(m => ({
          id: m.id,
          is_original_caption: m.is_original_caption,
          has_analyzed_content: !!m.analyzed_content,
          message_type: m.message_type
        }))
      });
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    
    // Analyze message content
    const messageType = determineMessageType(message);
    console.log('Analyzing message content:', {
      message_type: messageType,
      has_caption: !!message.caption,
      media_group_id: message.media_group_id,
      media_group_size: mediaGroupSize
    });

    const analyzedContent = await analyzeWebhookMessage(message, existingGroupMessages);
    console.log('Analysis result:', {
      is_original_caption: analyzedContent.is_original_caption,
      has_analyzed_content: !!analyzedContent.analyzed_content,
      original_message_id: analyzedContent.original_message_id
    });
    
    // Build message data structure
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);
    console.log('Built message data:', {
      message_id: messageData.message.message_id,
      has_caption: !!messageData.message.caption,
      has_analysis: !!messageData.analysis.analyzed_content,
      meta: messageData.meta
    });

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
        status: 'pending',  // Changed from processed to pending
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        message_media_data: messageData,
        last_group_message_at: new Date().toISOString()  // Add timestamp for group tracking
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    console.log('Created message record:', {
      id: messageRecord.id,
      message_type: messageRecord.message_type,
      is_original_caption: messageRecord.is_original_caption,
      has_analyzed_content: !!messageRecord.analyzed_content,
      media_group_size: messageRecord.media_group_size
    });

    // Queue message for processing if it's a media message
    if (messageType === 'photo' || messageType === 'video') {
      await queueWebhookMessage(supabase, messageData, correlationId, messageType);
      console.log('Queued message for processing:', {
        message_id: message.message_id,
        message_type: messageType,
        correlation_id: correlationId,
        media_group_id: message.media_group_id,
        media_group_size: mediaGroupSize
      });
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