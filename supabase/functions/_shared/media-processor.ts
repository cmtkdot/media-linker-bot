import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { downloadAndStoreThumbnail } from './thumbnail-handler.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { createSyncLogger, SyncErrorType } from './sync-logger.ts';

export async function processMediaFiles(
  message: any,
  messageRecord: any,
  supabase: any,
  botToken: string,
  correlationId = crypto.randomUUID()
) {
  const logger = createSyncLogger(correlationId);
  
  logger.log({
    operation: 'process_media_files',
    status: 'started',
    details: {
      message_id: message.message_id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    }
  });

  try {
    // Determine media files to process
    const mediaFiles = [];
    if (message.photo) {
      mediaFiles.push({
        type: 'photo',
        file: message.photo[message.photo.length - 1]
      });
    }
    if (message.video) mediaFiles.push({ type: 'video', file: message.video });
    if (message.document) mediaFiles.push({ type: 'document', file: message.document });
    if (message.animation) mediaFiles.push({ type: 'animation', file: message.animation });

    logger.log({
      operation: 'process_media_files',
      status: 'processing',
      details: {
        files_found: mediaFiles.length,
        file_types: mediaFiles.map(f => f.type)
      }
    });

    // Process each media file with database retry
    for (const { type, file } of mediaFiles) {
      logger.log({
        operation: 'process_media_file',
        status: 'processing',
        details: {
          file_id: file.file_id,
          file_type: type,
          message_id: messageRecord?.id
        }
      });

      // Check for existing media first using retry
      const { data: existingMedia, error: checkError } = await withDatabaseRetry(
        async () => {
          return await supabase
            .from('telegram_media')
            .select('id, public_url, updated_at')
            .eq('file_unique_id', file.file_unique_id)
            .maybeSingle();
        },
        0,
        `check_existing_media_${file.file_unique_id}`
      );

      if (checkError) {
        logger.log({
          operation: 'check_existing_media',
          status: 'error',
          errorType: SyncErrorType.DATABASE,
          details: {
            error: checkError.message,
            file_unique_id: file.file_unique_id
          }
        });
        throw checkError;
      }

      if (existingMedia) {
        logger.log({
          operation: 'check_existing_media',
          status: 'success',
          details: {
            message: 'Media already exists',
            media_id: existingMedia.id,
            last_updated: existingMedia.updated_at
          }
        });
        continue;
      }

      // Download and process file
      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

      logger.log({
        operation: 'upload_file',
        status: 'processing',
        details: {
          fileName,
          fileType: type,
          mimeType: getMimeType(filePath, 'application/octet-stream')
        }
      });

      // Upload to storage with retry
      try {
        await withDatabaseRetry(
          async () => {
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, buffer, {
                contentType: getMimeType(filePath, 'application/octet-stream'),
                upsert: true,
                cacheControl: '3600'
              });

            if (uploadError) throw uploadError;
          },
          0,
          `upload_file_${fileName}`
        );

        logger.log({
          operation: 'upload_file',
          status: 'success',
          details: { fileName }
        });
      } catch (uploadError) {
        logger.log({
          operation: 'upload_file',
          status: 'error',
          errorType: SyncErrorType.STORAGE,
          details: {
            error: uploadError.message,
            fileName
          }
        });
        throw uploadError;
      }

      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Create media record with retry
      try {
        await withDatabaseRetry(
          async () => {
            const { error: insertError } = await supabase
              .from('telegram_media')
              .insert([{
                file_id: file.file_id,
                file_unique_id: file.file_unique_id,
                file_type: type,
                message_id: messageRecord.id,
                public_url: publicUrl,
                caption: message.caption,
                telegram_data: {
                  message_id: message.message_id,
                  chat_id: message.chat.id,
                  media_group_id: message.media_group_id,
                  date: message.date,
                  storage_path: fileName
                }
              }]);

            if (insertError) throw insertError;
          },
          0,
          `create_media_record_${file.file_unique_id}`
        );

        logger.log({
          operation: 'create_media_record',
          status: 'success',
          details: {
            file_id: file.file_id,
            type,
            public_url: publicUrl
          }
        });
      } catch (insertError) {
        // If it's a duplicate key error, log it but don't throw
        if (insertError.code === '23505') {
          logger.log({
            operation: 'create_media_record',
            status: 'warning',
            details: {
              message: 'Duplicate record detected, continuing processing',
              file_unique_id: file.file_unique_id
            }
          });
        } else {
          logger.log({
            operation: 'create_media_record',
            status: 'error',
            errorType: SyncErrorType.DATABASE,
            details: {
              error: insertError.message,
              file_id: file.file_id
            }
          });
          throw insertError;
        }
      }
    }

    logger.log({
      operation: 'process_media_files',
      status: 'success',
      details: {
        processed_count: mediaFiles.length,
        message_id: message.message_id
      }
    });

    return { success: true };
  } catch (error) {
    logger.log({
      operation: 'process_media_files',
      status: 'error',
      errorType: SyncErrorType.UNKNOWN,
      details: {
        error: error.message,
        stack: error.stack,
        message_id: message?.message_id
      }
    });
    throw error;
  }
}