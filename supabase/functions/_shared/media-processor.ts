import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';

export async function processMediaFiles(
  message: any,
  messageRecord: any,
  supabase: any,
  botToken: string
) {
  const mediaTypes = ['photo', 'video', 'document', 'animation'];
  let mediaFile = null;
  let mediaType = '';

  // Find the first available media in the message
  for (const type of mediaTypes) {
    if (message[type]) {
      mediaFile = type === 'photo' 
        ? message[type][message[type].length - 1] 
        : message[type];
      mediaType = type;
      break;
    }
  }

  if (!mediaFile) {
    throw new Error('No media file found in message');
  }

  // Download and process file
  const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
  const mimeType = getMimeType(filePath, 'application/octet-stream');
  const fileName = `${mediaFile.file_unique_id}.${filePath.split('.').pop()}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = await supabase.storage
    .from('media')
    .getPublicUrl(fileName);

  // Create media record
  const { error: dbError } = await supabase
    .from('telegram_media')
    .insert({
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: mediaType,
      message_id: messageRecord.id,
      public_url: publicUrl,
      telegram_data: {
        message_id: message.message_id,
        chat_id: message.chat.id,
        media_group_id: message.media_group_id,
        storage_path: fileName
      }
    });

  if (dbError) throw dbError;

  return { success: true };
}