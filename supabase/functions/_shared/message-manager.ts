import { analyzeCaptionWithAI } from './caption-analyzer.ts';

export async function handleMessageProcessing(
  supabase: any,
  message: any,
  existingMessage: any,
  productInfo: any = null
) {
  const messageType = determineMessageType(message);
  if (!messageType) {
    console.error('Invalid message type:', message);
    return { success: false, error: 'Invalid message type' };
  }

  try {
    const { data: existingRecord, error: existingError } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing message:', existingError);
      return { success: false, error: existingError.message };
    }

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

    const { data: messageRecord, error: upsertError } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'message_id,chat_id',
        returning: 'representation'
      })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error('Error upserting message:', upsertError);
      return { success: false, error: upsertError.message };
    }

    return { 
      success: true,
      messageRecord,
      retryCount: messageRecord?.retry_count || 0,
      analyzedContent: productInfo 
    };

  } catch (error) {
    console.error('Error in handleMessageProcessing:', error);
    return { success: false, error: error.message };
  }
}

function determineMessageType(message: any): string | null {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return null;
}