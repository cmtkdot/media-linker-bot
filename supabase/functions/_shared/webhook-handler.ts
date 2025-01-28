import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramMessage, TelegramUpdate } from './telegram-types.ts';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';

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

    // Extract media type and file info
    const mediaType = getMediaType(message);
    console.log("Media type:", mediaType);

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
        media_group_size: message.media_group_id ? existingGroupMessages.length + 1 : null,
        last_group_message_at: message.media_group_id ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message record:", messageError);
      throw messageError;
    }

    console.log("Created message record:", messageRecord.id);

    // Log the initial media processing attempt
    if (mediaType) {
      const { error: logError } = await supabase
        .from("media_processing_logs")
        .insert({
          message_id: messageRecord.id,
          correlation_id: correlationId,
          status: "pending",
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error("Error creating media processing log:", logError);
      }
    }

    return {
      success: true,
      message: "Update processed successfully",
      messageId: messageRecord.id,
      data: {
        telegram_data: message,
        status: "pending",
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