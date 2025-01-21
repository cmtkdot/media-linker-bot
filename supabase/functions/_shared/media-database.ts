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
      .maybeSingle();

    if (mediaFetchError) throw mediaFetchError;
    if (!existingMedia) throw new Error('Existing media record not found');

    const videoMetadata = extractVideoMetadata(message);
    const telegramData = {
      ...existingMedia.telegram_data,
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      ...(videoMetadata && { video_metadata: videoMetadata })
    };

    const { error: mediaError } = await supabase
      .from('telegram_media')
      .update({
        telegram_data: telegramData,
        caption: message.caption,
        media_metadata: {
          ...existingMedia.media_metadata,
          ...(videoMetadata && { video: videoMetadata })
        },
        ...(productInfo && {
          product_name: productInfo.product_name,
          product_code: productInfo.product_code,
          quantity: productInfo.quantity,
          vendor_uid: productInfo.vendor_uid,
          purchase_date: productInfo.purchase_date,
          notes: productInfo.notes
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
  const metadata = buildMediaMetadata(mediaFile, mediaType, storagePath);
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
      media_metadata: metadata,
      caption: message.caption,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity,
        vendor_uid: productInfo.vendor_uid,
        purchase_date: productInfo.purchase_date,
        notes: productInfo.notes
      })
    });

  if (dbError) throw dbError;
};