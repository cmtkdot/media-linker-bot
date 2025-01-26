import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeCaptionWithAI } from "./caption-analyzer.ts";
import { withDatabaseRetry } from "./database-retry.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";
import { validateMediaFile } from "./media-validators.ts";
import { createTelegramMediaRecord } from "./telegram-media-processor.ts";

interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface MediaQueueItem {
  id: string;
  message_media_data: {
    message: {
      url: string;
      media_group_id?: string;
      caption?: string;
      message_id: number;
      chat_id: number;
      date: number;
    };
    sender: {
      sender_info: Record<string, any>;
      chat_info: Record<string, any>;
    };
    analysis: {
      analyzed_content?: Record<string, any>;
    };
    meta: {
      created_at: string;
      updated_at: string;
      status: string;
      error: string | null;
    };
    media: {
      file_id: string;
      file_unique_id: string;
      file_type: string;
      public_url?: string;
    };
    telegram_data: Record<string, any>;
  };
  status: string;
  correlation_id: string;
}

export async function processMediaItem(
  supabase: any,
  item: MediaQueueItem,
  botToken: string
) {
  try {
    console.log(`Processing media item ${item.id}`);

    // Create telegram_media record first
    const mediaRecord = await createTelegramMediaRecord(
      supabase,
      item.message_media_data,
      item.correlation_id
    );

    // Validate media file
    await validateMediaFile(item.message_media_data.media, item.message_media_data.media.file_type);

    // Download and process file
    console.log('Downloading file from Telegram:', item.message_media_data.media.file_id);
    const { buffer, filePath } = await getAndDownloadTelegramFile(
      item.message_media_data.media.file_id,
      botToken
    );

    // Upload to storage with optimizations
    const fileExt = filePath.split('.').pop() || '';
    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      item.message_media_data.media.file_unique_id,
      fileExt,
      item.message_media_data.media.file_type === 'video' ? {
        maxSize: 50 * 1024 * 1024, // 50MB limit for videos
        compress: true
      } : undefined
    );

    // Update telegram_media record with public URL
    const { error: updateError } = await supabase
      .from('telegram_media')
      .update({
        public_url: publicUrl,
        processed: true,
        updated_at: new Date().toISOString(),
        message_media_data: {
          ...item.message_media_data,
          media: {
            ...item.message_media_data.media,
            public_url: publicUrl
          },
          meta: {
            ...item.message_media_data.meta,
            status: 'processed',
            updated_at: new Date().toISOString()
          }
        }
      })
      .eq('id', mediaRecord.id);

    if (updateError) throw updateError;

    // Update queue status
    await withDatabaseRetry(async () => {
      const { error: queueError } = await supabase
        .from('unified_processing_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          message_media_data: {
            ...item.message_media_data,
            media: {
              ...item.message_media_data.media,
              public_url: publicUrl
            },
            meta: {
              ...item.message_media_data.meta,
              status: 'processed',
              updated_at: new Date().toISOString()
            }
          }
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
    const processError = {
      code: error.code || 'PROCESSING_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error.details || {}
    };

    await handleProcessingError(supabase, processError, item);
    throw error;
  }
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
    file_id: item.message_media_data.media.file_id,
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
