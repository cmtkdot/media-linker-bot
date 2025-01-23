export const updateExistingMedia = async (
  supabase: any,
  mediaFile: any,
  message: any,
  messageRecord: any,
  productInfo: any = null
) => {
  console.log('Updating existing media record for file_unique_id:', mediaFile.file_unique_id);
  
  try {
    const { data: existingMedia, error: mediaFetchError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .single();

    if (mediaFetchError) throw mediaFetchError;

    const telegramData = {
      ...existingMedia.telegram_data,
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id
    };

    const { error: mediaError } = await supabase
      .from('telegram_media')
      .update({
        telegram_data: telegramData,
        caption: message.caption,
        ...(productInfo && {
          product_name: productInfo.product_name,
          product_code: productInfo.product_code,
          quantity: productInfo.quantity,
          vendor_uid: productInfo.vendor_uid,
          purchase_date: productInfo.purchase_date,
          notes: productInfo.notes,
          analyzed_content: productInfo
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingMedia.id);

    if (mediaError) throw mediaError;

    return existingMedia;
  } catch (error) {
    console.error('Error in updateExistingMedia:', error);
    throw error;
  }
};

export const createNewMediaRecord = async (
  supabase: any,
  mediaFile: any,
  mediaType: string,
  message: any,
  messageRecord: any,
  publicUrl: string,
  storagePath: string,
  productInfo: any = null
) => {
  const telegramData = {
    message_id: message.message_id,
    chat_id: message.chat.id,
    sender_chat: message.sender_chat,
    chat: message.chat,
    date: message.date,
    caption: message.caption,
    media_group_id: message.media_group_id,
    storage_path: storagePath
  };

  const { error: dbError } = await supabase
    .from('telegram_media')
    .insert({
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: mediaType,
      message_id: messageRecord.id,
      public_url: publicUrl,
      telegram_data: telegramData,
      caption: message.caption,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes,
        analyzed_content: productInfo
      })
    });

  if (dbError) throw dbError;
};

export const generateThumbnails = async (supabase: any) => {
  try {
    // First, identify videos without thumbnails
    const { data: videosWithoutThumbnails, error: fetchError } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_type', 'video')
      .is('thumbnail_url', null);

    if (fetchError) throw fetchError;

    // Process each video
    for (const video of videosWithoutThumbnails || []) {
      let thumbnailUrl = null;

      // Try to get thumbnail from Telegram metadata
      const videoThumb = video.telegram_data?.message_data?.video?.thumb;
      if (videoThumb?.file_unique_id) {
        const { data } = supabase
          .storage
          .from('media')
          .getPublicUrl(`${videoThumb.file_unique_id}.jpg`);
        thumbnailUrl = data?.publicUrl;
      }

      // If no Telegram thumbnail, try media group photos
      if (!thumbnailUrl && video.telegram_data?.media_group_id) {
        const { data: photos } = await supabase
          .from('telegram_media')
          .select('public_url')
          .eq('telegram_data->media_group_id', video.telegram_data.media_group_id)
          .eq('file_type', 'photo')
          .limit(1);

        if (photos?.[0]?.public_url) {
          thumbnailUrl = photos[0].public_url;
        }
      }

      // If still no thumbnail, try metadata
      if (!thumbnailUrl && video.media_metadata?.thumbnail_path) {
        const { data } = supabase
          .storage
          .from('media')
          .getPublicUrl(video.media_metadata.thumbnail_path);
        thumbnailUrl = data?.publicUrl;
      }

      // Update the video record with the best available thumbnail
      if (thumbnailUrl) {
        await supabase
          .from('telegram_media')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', video.id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error generating thumbnails:', error);
    throw error;
  }
};
