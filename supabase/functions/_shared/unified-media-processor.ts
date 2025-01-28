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
      product_name?: string;
      product_code?: string;
      quantity?: number;
      vendor_uid?: string;
      purchase_date?: string;
      notes?: string;
    };
    meta: {
      created_at: string;
      updated_at: string;
      status: string;
      error: string | null;
      is_original_caption: boolean;
      original_message_id: string | null;
      processed_at: string | null;
      last_retry_at: string | null;
      retry_count: number;
    };
    media?: {
      file_id: string;
      file_unique_id: string;
      file_type: string;
      public_url?: string;
      storage_path?: string;
      mime_type?: string;
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

    if (!item.message_media_data?.media) {
      throw {
        code: 'INVALID_MEDIA',
        message: 'No media data found in message',
        details: { item_id: item.id }
      };
    }

    // Check for duplicate file_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, file_id')
      .eq('file_unique_id', item.message_media_data.media.file_unique_id)
      .maybeSingle();

    if (existingMedia) {
      throw {
        code: 'DUPLICATE_FILE',
        message: 'File already exists in telegram_media',
        details: { existing_id: existingMedia.id }
      };
    }

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
      item.message_media_data.media.mime_type
    );

    // Update message_media_data with public URL and storage info
    const updatedMessageMediaData = {
      ...item.message_media_data,
      media: {
        ...item.message_media_data.media,
        public_url: publicUrl,
        storage_path: `${item.message_media_data.media.file_unique_id}.${fileExt}`
      },
      meta: {
        ...item.message_media_data.meta,
        status: 'processed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };

    // Create telegram_media record
    const { data: mediaRecord, error: insertError } = await withDatabaseRetry(
      async () => {
        return await supabase
          .from('telegram_media')
          .insert({
            file_id: item.message_media_data.media.file_id,
            file_unique_id: item.message_media_data.media.file_unique_id,
            file_type: item.message_media_data.media.file_type,
            public_url: publicUrl,
            storage_path: updatedMessageMediaData.media.storage_path,
            message_media_data: updatedMessageMediaData,
            analyzed_content: item.message_media_data.analysis.analyzed_content || {},
            product_name: item.message_media_data.analysis.product_name,
            product_code: item.message_media_data.analysis.product_code,
            quantity: item.message_media_data.analysis.quantity,
            vendor_uid: item.message_media_data.analysis.vendor_uid,
            purchase_date: item.message_media_data.analysis.purchase_date,
            notes: item.message_media_data.analysis.notes,
            telegram_data: item.message_media_data.telegram_data,
            message_url: item.message_media_data.message.url,
            caption: item.message_media_data.message.caption,
            correlation_id: item.correlation_id
          })
          .select()
          .single();
      }
    );

    if (insertError) throw insertError;

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

    console.error('Error processing media:', processError);

    // Log the error to media_processing_logs
    await supabase
      .from('media_processing_logs')
      .insert({
        message_id: item.id,
        file_id: item.message_media_data?.media?.file_id,
        file_type: item.message_media_data?.media?.file_type,
        error_message: processError.message,
        correlation_id: item.correlation_id,
        status: 'error'
      });

    throw processError;
  }
}