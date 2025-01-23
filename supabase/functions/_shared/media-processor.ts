import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';

export async function processMediaFiles(
  message: any,
  messageRecord: any,
  supabase: any,
  botToken: string
) {
  console.log('Processing media files for message:', {
    message_id: message.message_id,
    media_group_id: message.media_group_id,
    has_caption: !!message.caption,
    has_analyzed_content: !!messageRecord.analyzed_content
  });

  try {
    // Determine media files to process
    const mediaFiles = [];
    if (message.photo) {
      mediaFiles.push({
        type: 'photo',
        file: message.photo[message.photo.length - 1]
      });
    }
    if (message.video) mediaFiles.push({ type: 'video', file: message.video });
    if (message.document) mediaFiles.push({ type: 'document', file: message.document });
    if (message.animation) mediaFiles.push({ type: 'animation', file: message.animation });

    console.log('Processing media files:', {
      count: mediaFiles.length,
      types: mediaFiles.map(f => f.type)
    });

    // Process each media file
    for (const { type, file } of mediaFiles) {
      // Download and upload file
      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

      console.log('Generated filename:', fileName);

      // Check if file already exists in storage
      const { data: existingFile } = await supabase.storage
        .from('media')
        .list('', {
          search: fileName
        });

      if (existingFile && existingFile.length > 0) {
        console.log('File already exists in storage:', fileName);
        continue;
      }
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, buffer, {
          contentType: getContentType(type, filePath),
          upsert: false,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Create media record
      const mediaRecord = {
        file_id: file.file_id,
        file_unique_id: file.file_unique_id,
        file_type: type,
        message_id: messageRecord.id,
        public_url: publicUrl,
        telegram_data: {
          message_id: message.message_id,
          chat_id: message.chat.id,
          sender_chat: message.sender_chat,
          chat: message.chat,
          date: message.date,
          caption: message.caption,
          media_group_id: message.media_group_id,
          storage_path: fileName
        },
        caption: message.caption,
        product_name: messageRecord.product_name,
        product_code: messageRecord.product_code,
        quantity: messageRecord.quantity,
        vendor_uid: messageRecord.vendor_uid,
        purchase_date: messageRecord.purchase_date,
        notes: messageRecord.notes,
        analyzed_content: messageRecord.analyzed_content
      };

      const { error: insertError } = await supabase
        .from('telegram_media')
        .insert(mediaRecord);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      console.log('Successfully processed media file:', {
        type,
        file_id: file.file_id,
        public_url: publicUrl
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing media files:', error);
    throw error;
  }
}

function getContentType(type: string, filePath: string): string {
  switch (type) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'document':
      return getMimeType(filePath, 'application/octet-stream');
    case 'animation':
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}