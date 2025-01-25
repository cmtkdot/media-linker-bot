import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function handleWebhookUpdate(
  update: any, 
  supabase: any, 
  botToken: string,
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
      correlation_id: correlationId
    });

    // Step 1: Extract caption from telegram data
    const caption = message.caption;
    let analyzedContent = {};

    // Step 2: Analyze caption if available
    if (caption) {
      try {
        console.log('Analyzing caption:', caption);
        analyzedContent = await analyzeCaptionWithAI(caption);
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
        // Even if analysis fails, keep empty object to trigger queue
        analyzedContent = {};
      }
    }

    // Step 3: Check for media group and sync analyzed content
    if (message.media_group_id) {
      console.log('Checking media group:', message.media_group_id);
      const { data: existingGroupAnalysis } = await supabase
        .from('messages')
        .select('analyzed_content')
        .eq('media_group_id', message.media_group_id)
        .not('analyzed_content', 'is', null)
        .maybeSingle();

      if (existingGroupAnalysis?.analyzed_content && Object.keys(analyzedContent).length === 0) {
        analyzedContent = existingGroupAnalysis.analyzed_content;
      }
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Step 4: Create message record with analyzed content
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      telegram_data: message,
      caption: message.caption,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      correlation_id: correlationId,
      analyzed_content: analyzedContent,
      status: 'pending',
      product_name: analyzedContent?.product_name || null,
      product_code: analyzedContent?.product_code || null,
      quantity: analyzedContent?.quantity || null,
      vendor_uid: analyzedContent?.vendor_uid || null,
      purchase_date: analyzedContent?.purchase_date || null,
      notes: analyzedContent?.notes || null
    };

    // Create or update message record with retry
    const messageRecord = await withDatabaseRetry(async () => {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('message_id', message.message_id)
        .eq('chat_id', message.chat_id)
        .maybeSingle();

      if (existingMessage) {
        const { data, error: updateError } = await supabase
          .from('messages')
          .update(messageData)
          .eq('id', existingMessage.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return data;
      } else {
        const { data, error: insertError } = await supabase
          .from('messages')
          .insert([messageData])
          .select()
          .single();

        if (insertError) throw insertError;
        return data;
      }
    });

    console.log('Message record created/updated:', {
      record_id: messageRecord?.id,
      correlation_id: correlationId,
      status: messageRecord?.status,
      has_analyzed_content: !!messageRecord?.analyzed_content,
      media_group_id: messageRecord?.media_group_id
    });

    return {
      success: true,
      message: 'Message processed successfully',
      messageId: messageRecord?.id,
      correlationId,
      status: messageRecord?.status
    };

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id,
      correlation_id: correlationId
    });
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
