import { withDatabaseRetry } from "./database-retry.ts";
import { validateMediaFile } from "./media-validators.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";
import {
  JsonValue,
  SupabaseClientWithDatabase,
  TelegramMedia,
} from "./types.ts";

export interface MediaProcessingResult {
  success: boolean;
  publicUrl?: string;
  storagePath?: string;
  error?: string;
  mediaId?: string;
}

export interface MediaProcessingParams {
  fileId: string;
  fileUniqueId: string;
  fileType: string;
  messageId: string;
  botToken: string;
  correlationId: string;
  caption?: string;
  messageUrl?: string;
  analyzedContent?: Record<string, JsonValue>;
}

export async function processMediaFile(
  supabase: SupabaseClientWithDatabase,
  params: MediaProcessingParams
): Promise<MediaProcessingResult> {
  const {
    fileId,
    fileUniqueId,
    fileType,
    messageId,
    botToken,
    correlationId,
    caption,
    messageUrl,
    analyzedContent,
  } = params;

  try {
    // Check for existing media first
    const { data: existingMedia } = await supabase
      .from("telegram_media")
      .select("*")
      .eq("file_unique_id", fileUniqueId)
      .maybeSingle();

    if (existingMedia) {
      console.log(`Media ${fileUniqueId} already exists`);
      return {
        success: true,
        publicUrl: existingMedia.public_url,
        storagePath: existingMedia.storage_path,
        mediaId: existingMedia.id,
      };
    }

    console.log("Processing media file:", {
      file_id: fileId,
      file_type: fileType,
      message_id: messageId,
    });

    // Log processing start
    await withDatabaseRetry(() =>
      supabase.from("media_processing_logs").insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        correlation_id: correlationId,
        status: "processing",
        processing_stage: "started",
      })
    );

    // Validate media file
    await validateMediaFile({ file_id: fileId }, fileType);

    // Download file from Telegram
    const { buffer, filePath } = await getAndDownloadTelegramFile(
      fileId,
      botToken
    );

    // Upload to Supabase Storage
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileType
    );

    // Create telegram_media record
    const mediaData: Partial<TelegramMedia> = {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: fileType,
      public_url: publicUrl,
      storage_path: storagePath,
      message_id: messageId,
      caption,
      message_url: messageUrl,
      analyzed_content: analyzedContent,
      processed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newMedia, error: insertError } = await supabase
      .from("telegram_media")
      .insert([mediaData])
      .select()
      .single();

    if (insertError) throw insertError;

    // Log success
    await withDatabaseRetry(() =>
      supabase.from("media_processing_logs").insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        correlation_id: correlationId,
        status: "success",
        processing_stage: "completed",
        processing_details: {
          public_url: publicUrl,
          storage_path: storagePath,
        },
      })
    );

    console.log("Successfully processed media file:", {
      file_id: fileId,
      public_url: publicUrl,
      media_id: newMedia.id,
    });

    return {
      success: true,
      publicUrl,
      storagePath,
      mediaId: newMedia.id,
    };
  } catch (error) {
    console.error("Error processing media file:", error);

    // Log error with details
    await withDatabaseRetry(() =>
      supabase.from("media_processing_logs").insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        error_message: error instanceof Error ? error.message : String(error),
        correlation_id: correlationId,
        status: "error",
        processing_stage: "failed",
        processing_details: {
          error_type: error.constructor.name,
          error_stack: error instanceof Error ? error.stack : undefined,
        },
      })
    );

    return {
      success: false,
      error: `Failed to process media: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
