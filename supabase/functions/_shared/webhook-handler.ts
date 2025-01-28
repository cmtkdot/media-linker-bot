import {
  logMediaProcessing,
  updateMediaRecords,
  uploadMediaToStorage,
  validateMediaFile,
} from "./media-handler.ts";
import { TelegramMessage, TelegramUpdate } from "./telegram-types.ts";
import { analyzeWebhookMessage } from "./webhook-message-analyzer.ts";
import { buildWebhookMessageData } from "./webhook-message-builder.ts";

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: any,
  correlationId: string,
  botToken: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    return {
      success: false,
      message: "No message in update",
      data: { status: "error" },
    };
  }

  try {
    console.log("Processing webhook update:", {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption,
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${
      message.message_id
    }`;

    // Check for existing messages in the same media group
    let existingGroupMessages = [];
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("media_group_id", message.media_group_id)
        .order("created_at", { ascending: true });

      existingGroupMessages = groupMessages || [];
      console.log(
        "Found existing group messages:",
        existingGroupMessages.length
      );
    }

    // Analyze message content
    const analyzedMessageContent = await analyzeWebhookMessage(
      message,
      existingGroupMessages
    );
    console.log("Message analysis result:", analyzedMessageContent);

    // Build message data structure
    const messageData = buildWebhookMessageData(
      message,
      messageUrl,
      analyzedMessageContent
    );
    console.log("Built message data structure");

    // Create message record first
    const { data: messageRecord, error: messageError } = await supabase
      .from("messages")
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: getMediaType(message) || "text",
        telegram_data: message,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        analyzed_content: analyzedMessageContent.analyzed_content,
        is_original_caption: analyzedMessageContent.is_original_caption,
        original_message_id: analyzedMessageContent.original_message_id,
        message_media_data: messageData,
        status: "pending",
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message record:", messageError);
      throw messageError;
    }

    console.log("Created message record:", messageRecord.id);

    // Process media if present
    const mediaType = getMediaType(message);
    if (mediaType) {
      const mediaFile =
        mediaType === "photo"
          ? message.photo?.[message.photo.length - 1]
          : message.video || message.document || message.animation;

      if (!mediaFile) {
        throw new Error(`No valid media file found for type: ${mediaType}`);
      }

      try {
        console.log("Processing media file:", {
          file_id: mediaFile.file_id,
          file_type: mediaType,
          message_id: messageRecord.id,
          file_size: mediaFile.file_size,
          dimensions:
            mediaType === "photo"
              ? {
                  width: mediaFile.width,
                  height: mediaFile.height,
                }
              : undefined,
        });

        // Validate media file
        await validateMediaFile(mediaFile, mediaType);

        // Get file from Telegram and upload to storage
        const { publicUrl, storagePath } = await uploadMediaToStorage(
          supabase,
          new ArrayBuffer(0),
          mediaFile.file_unique_id,
          mediaType,
          botToken,
          mediaFile.file_id,
          mediaFile
        );

        // Update message_media_data with upload results
        const updatedMessageMediaData = {
          ...messageData,
          media: {
            file_id: mediaFile.file_id,
            file_unique_id: mediaFile.file_unique_id,
            file_type: mediaType,
            public_url: publicUrl,
            storage_path: storagePath,
          },
          meta: {
            ...messageData.meta,
            status: "processed",
            processed_at: new Date().toISOString(),
          },
        };

        // Create telegram_media record using message_media_data
        const { data: telegramMedia, error: mediaError } = await supabase
          .from("telegram_media")
          .insert({
            message_id: messageRecord.id,
            file_id: updatedMessageMediaData.media.file_id,
            file_unique_id: updatedMessageMediaData.media.file_unique_id,
            file_type: updatedMessageMediaData.media.file_type,
            public_url: updatedMessageMediaData.media.public_url,
            storage_path: updatedMessageMediaData.media.storage_path,
            telegram_data: updatedMessageMediaData.telegram_data,
            message_media_data: updatedMessageMediaData,
            analyzed_content: updatedMessageMediaData.analysis.analyzed_content,
            correlation_id: correlationId,
            is_original_caption: analyzedMessageContent.is_original_caption,
            original_message_id: analyzedMessageContent.original_message_id,
            processed: false,
          })
          .select()
          .single();

        if (mediaError) {
          throw mediaError;
        }

        // Now update both messages and telegram_media tables in a transaction
        await updateMediaRecords(supabase, {
          messageId: messageRecord.id,
          publicUrl,
          storagePath,
          messageMediaData: updatedMessageMediaData,
        });

        // After successful transaction, mark telegram_media as processed
        const { error: updateError } = await supabase
          .from("telegram_media")
          .update({ processed: true })
          .eq("id", telegramMedia.id);

        if (updateError) {
          throw updateError;
        }

        // Log successful processing
        await logMediaProcessing(supabase, {
          messageId: messageRecord.id,
          fileId: mediaFile.file_id,
          fileType: mediaType,
          storagePath,
          correlationId,
        });

        console.log("Successfully processed media:", {
          file_unique_id: mediaFile.file_unique_id,
          public_url: publicUrl,
          media_id: messageRecord.id,
        });
      } catch (error) {
        console.error("Error processing media:", error);
        await supabase
          .from("messages")
          .update({
            processing_error:
              error instanceof Error ? error.message : String(error),
            status: "error",
          })
          .eq("id", messageRecord.id);

        throw error;
      }
    }

    return {
      success: true,
      message: "Update processed successfully",
      messageId: messageRecord.id,
      data: {
        telegram_data: message,
        status: "processed",
      },
    };
  } catch (error) {
    console.error("Error in webhook handler:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: {
        telegram_data: message,
        status: "error",
      },
    };
  }
}

function getMediaType(message: TelegramMessage): string | null {
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.document) return "document";
  if (message.animation) return "animation";
  return null;
}
