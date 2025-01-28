import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MessageMediaData, TelegramMediaFile } from "./media-types.ts";
import { validateMediaFile } from "./media-validators.ts";
import { uploadMediaToStorage } from "./media-storage.ts";

export async function processMediaMessage(
  supabase: SupabaseClient,
  messageId: string,
  fileId: string,
  fileUniqueId: string,
  fileType: string,
  botToken: string,
  mediaFile: TelegramMediaFile,
  correlationId: string
): Promise<{ publicUrl: string; storagePath: string }> {
  console.log("Processing media message:", {
    messageId,
    fileId,
    fileType,
    correlationId,
  });

  // Validate media file
  await validateMediaFile(mediaFile, fileType);

  // Upload to storage
  const { publicUrl, storagePath } = await uploadMediaToStorage(
    supabase,
    new ArrayBuffer(0),
    fileUniqueId,
    fileType,
    botToken,
    fileId,
    mediaFile
  );

  // Update message_media_data
  const { data: message } = await supabase
    .from('messages')
    .select('message_media_data')
    .eq('id', messageId)
    .single();

  if (!message) {
    throw new Error('Message not found');
  }

  const updatedMessageMediaData: MessageMediaData = {
    ...message.message_media_data,
    media: {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: fileType,
      public_url: publicUrl,
      storage_path: storagePath
    },
    meta: {
      ...message.message_media_data.meta,
      status: 'processed',
      processed_at: new Date().toISOString()
    }
  };

  // Update records
  await supabase.rpc('update_media_records', {
    p_message_id: messageId,
    p_public_url: publicUrl,
    p_storage_path: storagePath,
    p_message_media_data: updatedMessageMediaData
  });

  return { publicUrl, storagePath };
}