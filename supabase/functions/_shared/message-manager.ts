import { createMessage } from './database-service.ts';

export async function updateExistingMessage(supabase: any, message: any, messageId: string, productInfo: any) {
  console.log('Updating existing message with new product info:', {
    id: messageId,
    product_info: productInfo
  });

  const { error: updateError } = await supabase
    .from('messages')
    .update({
      caption: message.caption,
      product_name: productInfo?.product_name,
      product_code: productInfo?.product_code,
      quantity: productInfo?.quantity,
      vendor_uid: productInfo?.vendor_uid,
      purchase_date: productInfo?.purchase_date,
      notes: productInfo?.notes,
      analyzed_content: productInfo,
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId);

  if (updateError) throw updateError;

  if (message.media_group_id) {
    await updateMediaGroup(supabase, message, productInfo);
  }
}

export async function updateMediaGroup(supabase: any, message: any, productInfo: any) {
  const { error: mediaGroupUpdateError } = await supabase
    .from('telegram_media')
    .update({
      caption: message.caption,
      product_name: productInfo?.product_name,
      product_code: productInfo?.product_code,
      quantity: productInfo?.quantity,
      vendor_uid: productInfo?.vendor_uid,
      purchase_date: productInfo?.purchase_date,
      notes: productInfo?.notes,
      analyzed_content: productInfo,
      updated_at: new Date().toISOString()
    })
    .eq('telegram_data->media_group_id', message.media_group_id);

  if (mediaGroupUpdateError) {
    console.error('Error updating media group:', mediaGroupUpdateError);
  }
}

export async function handleMessageProcessing(
  supabase: any, 
  message: any, 
  existingMessage: any, 
  productInfo: any
) {
  let messageRecord = existingMessage;
  let retryCount = existingMessage?.retry_count || 0;

  if (existingMessage && productInfo) {
    try {
      await updateExistingMessage(supabase, message, existingMessage.id, productInfo);
      messageRecord = existingMessage;
    } catch (error) {
      console.error('Error updating existing message:', error);
      throw error;
    }
  } else if (!existingMessage) {
    try {
      messageRecord = await createMessage(supabase, message, productInfo);
      console.log('Created new message record:', {
        id: messageRecord.id,
        message_id: message.message_id
      });
    } catch (error) {
      console.error('Error creating message:', {
        error: error.message,
        message_id: message.message_id
      });
      throw error;
    }
  }

  return { messageRecord, retryCount };
}