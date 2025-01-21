import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database } from '../../../src/integrations/supabase/types';

export async function syncMediaGroupInfo(
  supabase: ReturnType<typeof createClient<Database>>,
  message: any,
  messageRecord: any
) {
  console.log('[Media Group Sync] Starting sync for message:', {
    message_id: message.message_id,
    media_group_id: message.media_group_id,
    caption: message.caption
  });

  if (!message.media_group_id) {
    console.log('[Media Group Sync] No media group ID, skipping sync');
    return;
  }

  try {
    // First, get all media in this group from messages table
    const { data: groupMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', message.media_group_id)
      .neq('id', messageRecord.id)
      .order('created_at', { ascending: false });

    if (messagesError) throw messagesError;

    console.log('[Media Group Sync] Found group messages:', {
      count: groupMessages?.length,
      media_group_id: message.media_group_id
    });

    // Then, get all media items with this group ID
    const { data: groupMedia, error: mediaError } = await supabase
      .from('telegram_media')
      .select('*')
      .filter('telegram_data->media_group_id', 'eq', message.media_group_id)
      .order('created_at', { ascending: false });

    if (mediaError) throw mediaError;

    console.log('[Media Group Sync] Found group media:', {
      count: groupMedia?.length,
      media_group_id: message.media_group_id
    });

    if (!groupMedia?.length) {
      console.log('[Media Group Sync] No existing media to sync');
      return;
    }

    // Get the latest non-null values from messages
    const latestValues = groupMessages?.reduce((acc, msg) => ({
      caption: acc.caption || msg.caption,
      product_name: acc.product_name || msg.product_name,
      product_code: acc.product_code || msg.product_code,
      quantity: acc.quantity || msg.quantity,
      vendor_uid: acc.vendor_uid || msg.vendor_uid,
      purchase_date: acc.purchase_date || msg.purchase_date,
      notes: acc.notes || msg.notes,
      analyzed_content: acc.analyzed_content || msg.analyzed_content
    }), {
      caption: messageRecord.caption,
      product_name: messageRecord.product_name,
      product_code: messageRecord.product_code,
      quantity: messageRecord.quantity,
      vendor_uid: messageRecord.vendor_uid,
      purchase_date: messageRecord.purchase_date,
      notes: messageRecord.notes,
      analyzed_content: messageRecord.analyzed_content
    });

    console.log('[Media Group Sync] Latest values:', latestValues);

    // Update all media in the group with the latest values
    const { error: updateError } = await supabase
      .from('telegram_media')
      .update({
        caption: latestValues.caption,
        product_name: latestValues.product_name,
        product_code: latestValues.product_code,
        quantity: latestValues.quantity,
        vendor_uid: latestValues.vendor_uid,
        purchase_date: latestValues.purchase_date,
        notes: latestValues.notes,
        analyzed_content: latestValues.analyzed_content,
        updated_at: new Date().toISOString()
      })
      .filter('telegram_data->media_group_id', 'eq', message.media_group_id);

    if (updateError) throw updateError;

    console.log('[Media Group Sync] Successfully updated media group:', {
      media_group_id: message.media_group_id,
      updated_count: groupMedia.length
    });

  } catch (error) {
    console.error('[Media Group Sync] Error:', error);
    throw error;
  }
}