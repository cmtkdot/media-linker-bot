import { analyzeCaptionWithAI } from './caption-analyzer.ts';

export async function handleMediaGroup(supabase: any, message: any, messageRecord: any) {
  if (!message.media_group_id) return null;

  console.log('Processing media group:', message.media_group_id);
  
  try {
    // First analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption, supabase);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Create or update media group record
    const { data: mediaGroup, error: groupError } = await supabase
      .from('media_groups')
      .upsert({
        media_group_id: message.media_group_id,
        caption: message.caption,
        analyzed_content: analyzedContent,
        product_name: analyzedContent?.product_name,
        product_code: analyzedContent?.product_code,
        quantity: analyzedContent?.quantity,
        vendor_uid: analyzedContent?.vendor_uid,
        purchase_date: analyzedContent?.purchase_date,
        notes: analyzedContent?.notes,
        sync_status: 'pending'
      })
      .select()
      .single();

    if (groupError) {
      console.error('Error updating media group:', groupError);
      throw groupError;
    }

    // Update all media in the group
    const { error: mediaUpdateError } = await supabase
      .from('telegram_media')
      .update({
        caption: message.caption,
        product_name: analyzedContent?.product_name,
        product_code: analyzedContent?.product_code,
        quantity: analyzedContent?.quantity,
        vendor_uid: analyzedContent?.vendor_uid,
        purchase_date: analyzedContent?.purchase_date,
        notes: analyzedContent?.notes,
        analyzed_content: analyzedContent
      })
      .eq('telegram_data->media_group_id', message.media_group_id);

    if (mediaUpdateError) {
      console.error('Error updating media records:', mediaUpdateError);
      throw mediaUpdateError;
    }

    return mediaGroup;
  } catch (error) {
    console.error('Error in handleMediaGroup:', error);
    throw error;
  }
}