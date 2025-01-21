export async function handleMediaGroup(supabase: any, message: any, messageRecord: any) {
  if (!message.media_group_id) return;

  console.log('Processing media group:', message.media_group_id);
  
  // Update all media in the group with the same information
  const { error: groupError } = await supabase
    .from('telegram_media')
    .update({ 
      caption: message.caption,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date
    })
    .eq('telegram_data->media_group_id', message.media_group_id);

  if (groupError) {
    console.error('Error updating media group:', {
      error: groupError,
      media_group_id: message.media_group_id
    });
    throw groupError;
  }
}