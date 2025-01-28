import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MessageMediaData, TelegramMediaFile, ProcessingResult } from "./media-types.ts";
import { validateMediaFile } from "./media-validators.ts";
import { uploadMediaToStorage } from "./media-storage.ts";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export async function processMediaMessage(
  supabase: SupabaseClient,
  messageId: string,
  fileId: string,
  fileUniqueId: string,
  fileType: string,
  botToken: string,
  mediaFile: TelegramMediaFile,
  correlationId: string
): Promise<ProcessingResult> {
  console.log("Processing media message:", {
    messageId,
    fileId,
    fileType,
    correlationId,
  });

  try {
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

    // Get current message data
    const { data: message } = await supabase
      .from('messages')
      .select('message_media_data')
      .eq('id', messageId)
      .single();

    if (!message) {
      throw new Error('Message not found');
    }

    // Update message_media_data
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

    // Update records using database function
    await supabase.rpc('update_media_records', {
      p_message_id: messageId,
      p_public_url: publicUrl,
      p_storage_path: storagePath,
      p_message_media_data: updatedMessageMediaData
    });

    return {
      success: true,
      message: 'Media processed successfully',
      data: {
        publicUrl,
        storagePath,
        messageId,
        status: 'processed'
      }
    };
  } catch (error) {
    console.error('Error processing media:', error);
    throw error;
  }
}

export async function processMessageQueue(
  supabase: SupabaseClient,
  correlationId: string
): Promise<void> {
  console.log('Processing message queue:', { correlationId });

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) throw error;
  if (!messages?.length) {
    console.log('No pending messages found');
    return;
  }

  for (const message of messages) {
    try {
      const mediaData = message.message_media_data?.media;
      if (!mediaData) continue;

      await processMediaMessage(
        supabase,
        message.id,
        mediaData.file_id,
        mediaData.file_unique_id,
        mediaData.file_type,
        '', // botToken will be passed from the edge function
        mediaData,
        correlationId
      );
    } catch (error) {
      console.error('Error processing message:', error);
      await updateMessageStatus(supabase, message.id, 'failed', error);
    }
  }
}

async function updateMessageStatus(
  supabase: SupabaseClient,
  messageId: string,
  status: string,
  error?: any
): Promise<void> {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString()
  };

  if (error) {
    updates.processing_error = error instanceof Error ? error.message : String(error);
  }

  if (status === 'completed') {
    updates.processed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId);

  if (updateError) throw updateError;
}