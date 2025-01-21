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
    product_info: productInfo,
    existing_message: existingMessage?.id
  });

  try {
    // Determine message type with proper validation
    const messageType = determineMessageType(message);
    if (!messageType) {
      console.error('Invalid message type:', message);
      throw new Error('Invalid message type');
    }

    console.log('Determined message type:', messageType);

    // Check for existing message
    const { data: existingRecord } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

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
      retry_count: existingRecord?.retry_count || 0,
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
    if (existingRecord) {
      console.log('Updating existing message:', {
        id: existingRecord.id,
        message_id: message.message_id
      });

      const { data: updatedMessage, error: updateError } = await supabase
        .from('messages')
        .update({
          ...messageData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error('Error updating message:', updateError);
        throw updateError;
      }

      messageRecord = updatedMessage;
    } else {
      console.log('Creating new message:', {
        message_id: message.message_id,
        chat_id: message.chat.id
      });

      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          ...messageData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Error creating message:', insertError);
        throw insertError;
      }

      messageRecord = newMessage;
    }

    if (!messageRecord) {
      throw new Error('Failed to create/update message record');
    }

    return { 
      messageRecord, 
      retryCount: messageRecord.retry_count,
      analyzedContent: productInfo 
    };
  } catch (error) {
    console.error('Error in handleMessageProcessing:', {
      error: error.message,
      stack: error.stack,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });
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