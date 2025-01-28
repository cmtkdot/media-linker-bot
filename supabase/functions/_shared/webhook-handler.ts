import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MessageMediaData, ProcessingResult } from "./media-types.ts";
import { processMediaMessage } from "./media-processor.ts";

export async function handleWebhookUpdate(
  update: any,
  supabase: ReturnType<typeof createClient>,
  correlationId: string,
  botToken: string
): Promise<ProcessingResult> {
  const message = update.message || update.channel_post;
  if (!message) {
    return {
      success: false,
      message: "No message in update",
      data: { status: "error" }
    };
  }

  try {
    console.log("Processing webhook update:", {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Build initial message_media_data
    const messageMediaData: MessageMediaData = {
      message: {
        url: messageUrl,
        media_group_id: message.media_group_id,
        caption: message.caption,
        message_id: message.message_id,
        chat_id: message.chat.id,
        date: message.date
      },
      sender: {
        sender_info: message.from || message.sender_chat || {},
        chat_info: message.chat
      },
      analysis: {
        analyzed_content: {},
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        correlation_id: correlationId
      },
      media: {},
      telegram_data: message
    };

    // Create message record
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
        message_media_data: messageMediaData,
        status: "pending"
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message record:", messageError);
      throw messageError;
    }

    // Process media if present
    const mediaType = getMediaType(message);
    if (mediaType) {
      const mediaFile = getMediaFile(message, mediaType);
      if (!mediaFile) {
        throw new Error(`No valid media file found for type: ${mediaType}`);
      }

      return await processMediaMessage(
        supabase,
        messageRecord.id,
        mediaFile.file_id,
        mediaFile.file_unique_id,
        mediaType,
        botToken,
        mediaFile,
        correlationId
      );
    }

    return {
      success: true,
      message: "Update processed successfully",
      data: {
        messageId: messageRecord.id,
        status: "processed"
      }
    };
  } catch (error) {
    console.error("Error in webhook handler:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      data: { status: "error" },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function getMediaType(message: any): string | null {
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.document) return "document";
  if (message.animation) return "animation";
  return null;
}

function getMediaFile(message: any, mediaType: string): any {
  if (mediaType === "photo") {
    return message.photo[message.photo.length - 1];
  }
  return message.video || message.document || message.animation;
}