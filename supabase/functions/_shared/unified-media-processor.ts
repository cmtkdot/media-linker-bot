import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeCaptionWithAI } from "./caption-analyzer.ts";
import { withDatabaseRetry } from "./database-retry.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";
import { validateMediaFile } from "./media-validators.ts";

interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface MediaQueueItem {
  id: string;
  data: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    message: {
      media_group_id?: string;
      caption?: string;
    };
    analysis?: {
      analyzed_content?: Record<string, any>;
    };
    telegram_data: Record<string, any>;
  };
  status: string;
  correlation_id: string;
}

async function handleProcessingError(
  supabase: any,
  error: ProcessingError,
  item: MediaQueueItem
): Promise<void> {
  console.error('Media processing error:', {
    error_code: error.code,
    error_message: error.message,
    item_id: item.id,
    file_id: item.data.file_id,
    details: error.details
  });

  await withDatabaseRetry(async () => {
    const { error: updateError } = await supabase
      .from('unified_processing_queue')
      .update({
        status: 'error',
        error_message: JSON.stringify({
          code: error.code,
          message: error.message,
          details: error.details
        }),
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    if (updateError) throw updateError;
  });
}

export async function processMediaItem(
  supabase: any,
  item: MediaQueueItem,
  botToken: string
) {
  try {
    console.log(`Processing media item ${item.id}`);

    // Check for duplicate file_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, file_id')
      .eq('file_unique_id', item.data.file_unique_id)
      .maybeSingle();

    if (existingMedia) {
      throw {
        code: 'DUPLICATE_FILE',
        message: 'File already exists in telegram_media',
        details: { existing_id: existingMedia.id }
      };
    }

    // Validate media file
    await validateMediaFile(item.data, item.data.file_type);

    // Download and process file
    console.log('Downloading file from Telegram:', item.data.file_id);
    const { buffer, filePath } = await getAndDownloadTelegramFile(
      item.data.file_id,
      botToken
    );

    // Upload to storage with optimizations
    const fileExt = filePath.split('.').pop() || '';
    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      item.data.file_unique_id,
      fileExt,
      item.data.file_type === 'video' ? {
        maxSize: 50 * 1024 * 1024, // 50MB limit for videos
        compress: true
      } : undefined
    );

    // Create telegram_media record
    const { data: mediaRecord, error: insertError } = await withDatabaseRetry(
      async () => {
        return await supabase
          .from('telegram_media')
          .insert({
            file_id: item.data.file_id,
            file_unique_id: item.data.file_unique_id,
            file_type: item.data.file_type,
            public_url: publicUrl,
            analyzed_content: item.data.analysis?.analyzed_content || {},
            telegram_data: item.data.telegram_data,
            message_media_data: {
              message: item.data.message,
              sender: item.data.telegram_data.from || item.data.telegram_data.sender_chat,
              analysis: {
                analyzed_content: item.data.analysis?.analyzed_content || {}
              },
              meta: {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'processed',
                error: null
              }
            }
          })
          .select()
          .single();
      }
    );

    if (insertError) throw insertError;

    // Update queue status
    await withDatabaseRetry(async () => {
      const { error: queueError } = await supabase
        .from('unified_processing_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (queueError) throw queueError;
    });

    console.log('Successfully processed media item:', {
      item_id: item.id,
      media_id: mediaRecord.id,
      public_url: publicUrl
    });

    return mediaRecord;

  } catch (error) {
    const processError: ProcessingError = {
      code: error.code || 'PROCESSING_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error.details || {}
    };

    await handleProcessingError(supabase, processError, item);
    throw error;
  }
}