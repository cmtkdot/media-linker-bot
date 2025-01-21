export async function syncMediaGroupCaptions(mediaGroupId: string, supabase: any) {
  if (!mediaGroupId) return null;

  console.log('Syncing captions for media group:', mediaGroupId);

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: false });

  if (!messages?.length) return null;

  // Get the most recent message with caption or product info
  const latestMessageWithInfo = messages.find(msg => 
    msg.caption || 
    msg.product_name || 
    msg.product_code || 
    msg.analyzed_content
  );

  if (!latestMessageWithInfo) return null;

  // Update all messages in the group with the latest info
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      caption: latestMessageWithInfo.caption,
      product_name: latestMessageWithInfo.product_name,
      product_code: latestMessageWithInfo.product_code,
      quantity: latestMessageWithInfo.quantity,
      vendor_uid: latestMessageWithInfo.vendor_uid,
      purchase_date: latestMessageWithInfo.purchase_date,
      notes: latestMessageWithInfo.notes,
      analyzed_content: latestMessageWithInfo.analyzed_content
    })
    .eq('media_group_id', mediaGroupId);

  if (updateError) {
    console.error('Error syncing captions:', updateError);
    throw updateError;
  }

  return latestMessageWithInfo;
}