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

async function getOriginalCaptionData(supabase: any, mediaGroupId: string) {
  const { data: originalMessage, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .eq('is_original_caption', true)
    .single();

  if (error) {
    console.error('Error fetching original caption:', error);
    return null;
  }

  return originalMessage;
}

async function syncMessageMediaData(supabase: any, messageId: string, originalData: any) {
  if (!originalData || !originalData.message_media_data) return;

  const { error } = await supabase
    .from('messages')
    .update({
      message_media_data: {
        ...originalData.message_media_data,
        meta: {
          ...originalData.message_media_data.meta,
          is_original_caption: false,
          original_message_id: originalData.id
        }
      },
      analyzed_content: originalData.analyzed_content,
      product_name: originalData.product_name,
      product_code: originalData.product_code,
      quantity: originalData.quantity,
      vendor_uid: originalData.vendor_uid,
      purchase_date: originalData.purchase_date,
      notes: originalData.notes,
      caption: originalData.caption,
      original_message_id: originalData.id,
      is_original_caption: false
    })
    .eq('id', messageId);

  if (error) {
    console.error('Error syncing message media data:', error);
  }
}

async function waitForMediaGroupCompletion(supabase: any, mediaGroupId: string, maxAttempts = 5): Promise<boolean> {
  console.log(`Waiting for media group ${mediaGroupId} to complete...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, message_type, media_group_size')
      .eq('media_group_id', mediaGroupId);

    if (error) {
      console.error('Error checking media group:', error);
      continue;
    }

    const hasVideo = messages.some(m => m.message_type === 'video');
    const expectedSize = messages[0]?.media_group_size || 0;
    const currentSize = messages.length;

    console.log(`Media group status: ${currentSize}/${expectedSize} messages, has video: ${hasVideo}`);

    if (currentSize >= expectedSize) {
      if (hasVideo) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`Media group ${mediaGroupId} incomplete after ${maxAttempts} attempts`);
  return false;
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

    let mediaGroupSize = 0;
    let originalCaptionData = null;
    
    if (message.media_group_id) {
      // Get original caption data if it exists
      originalCaptionData = await getOriginalCaptionData(supabase, message.media_group_id);
      
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, message_type, media_group_size')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      mediaGroupSize = groupMessages?.[0]?.media_group_size || 1;
      
      // Calculate media group size if not already set
      if (!mediaGroupSize) {
        mediaGroupSize = message.photo ? 1 : 0;
        mediaGroupSize += message.video ? 1 : 0;
        mediaGroupSize += message.document ? 1 : 0;
        mediaGroupSize += message.animation ? 1 : 0;
        mediaGroupSize = Math.max(mediaGroupSize, 1);
      }

      const messageType = determineMessageType(message);
      if (messageType === 'photo' && mediaGroupSize > 1) {
        const isComplete = await waitForMediaGroupCompletion(supabase, message.media_group_id);
        if (!isComplete) {
          console.log('Media group not complete, continuing anyway');
        }
      }
    }

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    
    const messageType = determineMessageType(message);
    const analyzedContent = await analyzeWebhookMessage(message, originalCaptionData);
    
    let messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    // If we have original caption data, merge it with the current message data
    if (originalCaptionData && !analyzedContent.is_original_caption) {
      messageData = {
        ...messageData,
        analysis: originalCaptionData.message_media_data.analysis,
        meta: {
          ...messageData.meta,
          is_original_caption: false,
          original_message_id: originalCaptionData.id
        }
      };
    }

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
        caption: message.caption || originalCaptionData?.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        media_group_size: mediaGroupSize,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: originalCaptionData?.id,
        analyzed_content: analyzedContent.analyzed_content || originalCaptionData?.analyzed_content,
        message_media_data: messageData,
        last_group_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    // If this is part of a media group and not the original caption,
    // sync with the original caption data
    if (message.media_group_id && originalCaptionData && !analyzedContent.is_original_caption) {
      await syncMessageMediaData(supabase, messageRecord.id, originalCaptionData);
    }

    // Queue for processing if media type
    if (messageType === 'photo' || messageType === 'video') {
      let shouldQueue = true;
      let shouldMarkProcessed = false;

      if (message.media_group_id) {
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