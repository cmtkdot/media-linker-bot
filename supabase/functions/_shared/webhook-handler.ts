import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramMessage, TelegramUpdate } from './telegram-types.ts';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';
import { processMediaMessage } from './media/processor.ts';
import { handleMediaError } from './media/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: ReturnType<typeof createClient>,
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

    // Extract media type and file info before creating message record
    const mediaType = getMediaType(message);
    const mediaFile = mediaType ? extractMediaFile(message, mediaType) : null;

    // Create message record
    const { data: messageRecord, error: messageError } = await supabase
      .from("messages")
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: mediaType || "text",
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

    // Only process media if we have valid media file information
    if (mediaFile && mediaType) {
      console.log("Processing media file:", {
        file_id: mediaFile.file_id,
        file_type: mediaType,
        message_id: messageRecord.id,
      });

      try {
        // Process media using the dedicated processor
        await processMediaMessage(supabase, messageRecord, botToken);
      } catch (error) {
        console.error("Error processing media:", error);
        await handleMediaError(
          supabase,
          error,
          messageRecord.id,
          correlationId,
          'processMediaMessage',
          0
        );
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

function extractMediaFile(message: TelegramMessage, mediaType: string) {
  if (mediaType === "photo") {
    const photos = message.photo || [];
    return photos[photos.length - 1]; // Get largest photo
  }
  return message.video || message.document || message.animation || null;
}