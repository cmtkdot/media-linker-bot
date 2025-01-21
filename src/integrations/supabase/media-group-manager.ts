export async function syncMediaGroupCaptions(
  supabase: any,
  mediaGroupId: string,
  analyzedContent: any = null,
  caption: string | null = null
) {
  console.log('[Media Group] Syncing group:', {
    mediaGroupId,
    hasAnalyzedContent: !!analyzedContent,
    caption
  });

  try {
    // Get all media in this group ordered by creation date
    const { data: groupMedia, error: fetchError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('telegram_data->>media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    if (!groupMedia?.length) {
      console.log('[Media Group] No media found for group:', mediaGroupId);
      return;
    }

    // Get the most complete item (preferring items with captions/analysis)
    const mostCompleteItem = groupMedia.reduce((prev, current) => {
      const prevScore = (prev.caption ? 1 : 0) + (prev.analyzed_content ? 1 : 0);
      const currentScore = (current.caption ? 1 : 0) + (current.analyzed_content ? 1 : 0);
      return currentScore > prevScore ? current : prev;
    });

    // Prepare update data
    const updateData = {
      caption: caption || mostCompleteItem.caption,
      ...(analyzedContent && {
        product_name: analyzedContent.product_name,
        product_code: analyzedContent.product_code,
        quantity: analyzedContent.quantity,
        vendor_uid: analyzedContent.vendor_uid,
        purchase_date: analyzedContent.purchase_date,
        notes: analyzedContent.notes,
        analyzed_content: analyzedContent
      })
    };

    // Update all media items in the group
    const { error: updateError } = await supabase
      .from('telegram_media')
      .update(updateData)
      .eq('telegram_data->>media_group_id', mediaGroupId);

    if (updateError) throw updateError;

    // Update corresponding messages
    const { error: messagesError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('media_group_id', mediaGroupId);

    if (messagesError) throw messagesError;

    console.log('[Media Group] Sync completed successfully');
    return true;
  } catch (error) {
    console.error('[Media Group] Sync error:', error);
    throw error;
  }
}

export async function getMediaGroupInfo(
  supabase: any,
  mediaGroupId: string
) {
  try {
    const { data, error } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('telegram_data->>media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Media Group] Error fetching group info:', error);
    throw error;
  }
}