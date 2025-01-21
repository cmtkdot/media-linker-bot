export async function syncMediaGroupCaptions(mediaGroupId: string, supabase: any) {
  if (!mediaGroupId) {
    console.log('No media group ID provided');
    return null;
  }

  console.log('Syncing captions for media group:', mediaGroupId);

  try {
    // Get all messages in the group
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    if (!messages?.length) {
      console.log('No messages found for media group:', mediaGroupId);
      return null;
    }

    // Get the most recent message with any relevant information
    const latestMessageWithInfo = messages.find(msg => 
      msg.caption || 
      msg.product_name || 
      msg.product_code || 
      msg.analyzed_content ||
      msg.vendor_uid ||
      msg.purchase_date ||
      msg.notes
    );

    if (!latestMessageWithInfo) {
      console.log('No message with information found in group:', mediaGroupId);
      return null;
    }

    console.log('Found latest message with info:', {
      message_id: latestMessageWithInfo.message_id,
      has_caption: !!latestMessageWithInfo.caption,
      has_product_info: !!latestMessageWithInfo.product_name
    });

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

    console.log('Successfully synced media group:', mediaGroupId);
    return latestMessageWithInfo;
  } catch (error) {
    console.error('Error in syncMediaGroupCaptions:', error);
    throw error;
  }
}