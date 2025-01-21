import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { processMedia } from './media-handler.ts';

export async function handleMessageProcessing(
  supabase: any,
  message: any,
  existingMessage: any,
  productInfo: any = null
) {
  console.log('Processing message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    existing: !!existingMessage
  });

  try {
    // Start caption analysis early if caption exists
    const captionAnalysisPromise = message.caption 
      ? analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )
      : Promise.resolve(null);

    // Prepare message data
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: message.photo ? 'photo' : 
                   message.video ? 'video' : 
                   message.document ? 'document' : 
                   message.animation ? 'animation' : 'unknown',
      message_data: message,
      caption: message.caption,
      media_group_id: message.media_group_id,
      status: 'pending',
      retry_count: existingMessage?.retry_count || 0
    };

    // Wait for caption analysis result
    const analyzedContent = await captionAnalysisPromise;
    if (analyzedContent) {
      Object.assign(messageData, {
        product_name: analyzedContent.product_name,
        product_code: analyzedContent.product_code,
        quantity: analyzedContent.quantity,
        vendor_uid: analyzedContent.vendor_uid,
        purchase_date: analyzedContent.purchase_date,
        notes: analyzedContent.notes,
        analyzed_content: analyzedContent
      });
    }

    let messageRecord;
    if (existingMessage) {
      const { data: updatedMessage, error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;
      messageRecord = updatedMessage;
    } else {
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      messageRecord = newMessage;
    }

    return { 
      messageRecord, 
      retryCount: messageRecord.retry_count,
      analyzedContent 
    };
  } catch (error) {
    console.error('Error in handleMessageProcessing:', error);
    throw error;
  }
}