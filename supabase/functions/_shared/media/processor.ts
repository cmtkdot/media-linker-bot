import { SupabaseClient } from "@supabase/supabase-js";
import { validateMediaFile } from "./validators";
import { uploadMediaToStorage } from "./storage";
import { getMediaType } from "./utils";

export async function processMediaMessage(
  supabase: SupabaseClient,
  message: Record<string, any>,
  botToken: string
): Promise<void> {
  const mediaType = getMediaType(message);
  if (!mediaType) {
    throw new Error("No media found in message");
  }

  const mediaFile = mediaType === "photo"
    ? message.photo[message.photo.length - 1]
    : message[mediaType];

  if (!mediaFile) {
    throw new Error(`No valid media file found for type: ${mediaType}`);
  }

  // Validate media file
  await validateMediaFile(mediaFile, mediaType);

  // Upload to storage
  const { publicUrl, storagePath, isExisting } = await uploadMediaToStorage(
    supabase,
    new ArrayBuffer(0),
    mediaFile.file_unique_id,
    mediaType,
    {
      botToken,
      fileId: mediaFile.file_id,
    }
  );

  // Update message_media_data
  const messageMediaData = {
    ...message.message_media_data,
    media: {
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: mediaType,
      public_url: publicUrl,
      storage_path: storagePath,
    },
    meta: {
      ...message.message_media_data?.meta,
      status: "processed",
      processed_at: new Date().toISOString(),
    },
  };

  // Update database records
  await updateMediaRecords(supabase, {
    messageId: message.id,
    publicUrl,
    storagePath,
    messageMediaData,
  });

  // Log processing
  await logMediaProcessing(supabase, {
    messageId: message.id,
    fileId: mediaFile.file_id,
    fileType: mediaType,
    storagePath,
    correlationId: message.correlation_id,
  });
}

async function updateMediaRecords(
  supabase: SupabaseClient,
  {
    messageId,
    publicUrl,
    storagePath,
    messageMediaData,
  }: {
    messageId: string;
    publicUrl: string;
    storagePath: string;
    messageMediaData: Record<string, any>;
  }
): Promise<void> {
  await supabase.rpc("update_media_records", {
    p_message_id: messageId,
    p_public_url: publicUrl,
    p_storage_path: storagePath,
    p_message_media_data: messageMediaData,
  });
}

async function logMediaProcessing(
  supabase: SupabaseClient,
  {
    messageId,
    fileId,
    fileType,
    storagePath,
    correlationId,
    status = "processed",
    error = null,
  }: {
    messageId: string;
    fileId: string;
    fileType: string;
    storagePath: string;
    correlationId: string;
    status?: string;
    error?: string | null;
  }
): Promise<void> {
  try {
    await supabase
      .from("media_processing_logs")
      .insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        status,
        storage_path: storagePath,
        correlation_id: correlationId,
        error_message: error,
        processed_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Failed to log media processing:", error);
  }
}