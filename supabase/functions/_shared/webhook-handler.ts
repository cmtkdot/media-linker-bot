import { MediaProcessingParams, processMediaFile } from "./media-processor.ts";
import { TelegramMessage, TelegramUpdate, TelegramPhotoSize } from "./telegram-types.ts";
import { SupabaseClientWithDatabase } from "./types.ts";
import { analyzeWebhookMessage } from "./webhook-message-analyzer.ts";
import { buildWebhookMessageData } from "./webhook-message-builder.ts";

// Helper function to get highest quality photo
function getHighestQualityPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize {
  return photos.sort((a, b) => {
    const sizeA = a.file_size || 0;
    const sizeB = b.file_size || 0;
    return sizeB - sizeA;
  })[0];
}

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: SupabaseClientWithDatabase,
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
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Check for existing messages in the same media group
    let existingGroupMessages = [];
    if (message.media_group_id) {
      const { data: groupMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("media_group_id", message.media_group_id)
        .order("created_at", { ascending: true });

      existingGroupMessages = groupMessages || [];
      console.log("Found existing group messages:", existingGroupMessages.length);
    }

    // Analyze message content
    const analyzedMessageContent = await analyzeWebhookMessage(message, existingGroupMessages);
    console.log("Message analysis result:", analyzedMessageContent);

    // Build message data structure
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedMessageContent);
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
      const mediaFile = mediaType === "photo"
        ? getHighestQualityPhoto(message.photo || [])
        : message.video || message.document || message.animation;

      if (mediaFile) {
        try {
          console.log("Processing media file:", {
            file_id: mediaFile.file_id,
            file_type: mediaType,
            message_id: messageRecord.id
          });

          // Create telegram_media record first
          const { data: telegramMedia, error: mediaError } = await supabase
            .from("telegram_media")
            .insert({
              file_id: mediaFile.file_id,
              file_unique_id: mediaFile.file_unique_id,
              file_type: mediaType,
              message_id: messageRecord.id,
              telegram_data: message,
              message_media_data: messageData,
              correlation_id: correlationId
            })
            .select()
            .single();

          if (mediaError) {
            throw mediaError;
          }

          console.log("Created telegram_media record:", telegramMedia.id);

          // Process media file and upload to storage
          const processingParams: MediaProcessingParams = {
            fileId: mediaFile.file_id,
            fileUniqueId: mediaFile.file_unique_id,
            fileType: mediaType,
            messageId: messageRecord.id,
            botToken,
            correlationId,
            caption: message.caption,
            messageUrl,
            analyzedContent: analyzedMessageContent.analyzed_content,
          };

          const result = await processMediaFile(supabase, processingParams);

          if (!result.success) {
            throw new Error(result.error);
          }

          console.log("Successfully processed media:", {
            file_unique_id: mediaFile.file_unique_id,
            public_url: result.publicUrl,
            media_id: result.mediaId,
          });
        } catch (error) {
          console.error("Error processing media:", error);
          await supabase
            .from("messages")
            .update({
              processing_error: error instanceof Error ? error.message : String(error),
              status: "error",
            })
            .eq("id", messageRecord.id);

          throw error;
        }
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