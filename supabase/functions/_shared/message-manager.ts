import { syncMediaGroupCaptions } from './media-group-manager.ts';

export async function createMessage(
  supabase: any,
  message: any,
  productInfo: any = null
) {
  if (!message?.message_id || !message?.chat?.id) {
    console.error('[Message] Invalid data:', { message });
    throw new Error('Invalid message data: missing required fields');
  }

  console.log('[Message] Processing:', { 
    message_id: message.message_id, 
    chat_id: message.chat.id,
    media_group_id: message.media_group_id,
    has_product_info: !!productInfo
  });

  try {
    // Check for existing message
    const { data: existingMessage, error: existingError } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingError) throw existingError;

    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: getMessageType(message),
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

    // Insert or update message
    const { data: messageRecord, error: upsertError } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'message_id,chat_id',
        returning: 'representation'
      })
      .select()
      .maybeSingle();

    if (upsertError) throw upsertError;

    // If part of a media group, sync information
    if (message.media_group_id && (message.caption || productInfo)) {
      await syncMediaGroupCaptions(
        supabase,
        message.media_group_id,
        productInfo,
        message.caption
      );
    }

    return messageRecord;

  } catch (error) {
    console.error('[Message] Processing error:', {
      error: error.message,
      stack: error.stack,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });
    throw error;
  }
}

function getMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}