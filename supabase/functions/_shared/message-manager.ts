import { analyzeCaptionWithAI } from './caption-analyzer.ts';

export async function handleMessageProcessing(
  supabase: any,
  message: any,
  existingMessage: any,
  productInfo: any = null
) {
  console.log('Processing message:', { 
    message_id: message.message_id, 
    chat_id: message.chat.id,
    product_info: productInfo 
  });

  try {
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

    // Add product info if available
    if (productInfo) {
      Object.assign(messageData, {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes,
        analyzed_content: productInfo
      });
    }

    let messageRecord;
    if (existingMessage) {
      console.log('Updating existing message:', {
        id: existingMessage.id,
        message_id: message.message_id
      });

      // Check if there are actual updates to apply
      const hasUpdates = Object.keys(messageData).some(key => 
        JSON.stringify(messageData[key]) !== JSON.stringify(existingMessage[key])
      );

      if (hasUpdates || !existingMessage.processed_at) {
        const { data: updatedMessage, error: updateError } = await supabase
          .from('messages')
          .update({
            ...messageData,
            // Reset processing status if no previous successful processing
            status: existingMessage.processed_at ? existingMessage.status : 'pending',
            retry_count: existingMessage.processed_at ? existingMessage.retry_count : 0
          })
          .eq('id', existingMessage.id)
          .select()
          .maybeSingle();

        if (updateError) throw updateError;
        if (!updatedMessage) throw new Error('Failed to update message record');
        
        messageRecord = updatedMessage;
      } else {
        messageRecord = existingMessage;
      }
    } else {
      console.log('Creating new message:', {
        message_id: message.message_id,
        chat_id: message.chat.id
      });

      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .maybeSingle();

      if (insertError) throw insertError;
      if (!newMessage) throw new Error('Failed to create message record');
      
      messageRecord = newMessage;
    }

    return { 
      messageRecord, 
      retryCount: messageRecord.retry_count,
      analyzedContent: productInfo 
    };
  } catch (error) {
    console.error('Error in handleMessageProcessing:', error);
    throw error;
  }
}