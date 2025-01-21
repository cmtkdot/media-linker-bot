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
    // Determine message type with proper validation
    const messageType = determineMessageType(message);
    if (!messageType) {
      console.error('Invalid message type:', message);
      throw new Error('Invalid message type');
    }

    // Prepare message data with validated type
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: messageType,
      message_data: message,
      caption: message.caption,
      media_group_id: message.media_group_id,
      status: 'pending',
      retry_count: existingMessage?.retry_count || 0,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes,
        analyzed_content: productInfo
      })
    };

    let messageRecord;
    if (existingMessage) {
      console.log('Updating existing message:', {
        id: existingMessage.id,
        message_id: message.message_id
      });

      const hasUpdates = Object.keys(messageData).some(key => 
        JSON.stringify(messageData[key]) !== JSON.stringify(existingMessage[key])
      );

      if (hasUpdates || !existingMessage.processed_at) {
        const { data: updatedMessage, error: updateError } = await supabase
          .from('messages')
          .update({
            ...messageData,
            status: existingMessage.processed_at ? existingMessage.status : 'pending',
            retry_count: existingMessage.processed_at ? existingMessage.retry_count : 0
          })
          .eq('id', existingMessage.id)
          .select()
          .maybeSingle();

        if (updateError) {
          console.error('Error updating message:', updateError);
          throw updateError;
        }
        if (!updatedMessage) {
          console.error('Failed to update message record');
          throw new Error('Failed to update message record');
        }
        
        messageRecord = updatedMessage;
      } else {
        messageRecord = existingMessage;
      }
    } else {
      console.log('Creating new message:', {
        message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: messageType
      });

      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Error creating message:', insertError);
        throw insertError;
      }
      if (!newMessage) {
        console.error('Failed to create message record');
        throw new Error('Failed to create message record');
      }
      
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

function determineMessageType(message: any): string | null {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return null;
}