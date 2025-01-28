import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSafeFileName, getMimeType } from './media-validators.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  mimeType?: string,
  retryCount = 0
): Promise<{ publicUrl: string; storagePath: string }> => {
  console.log('Starting media upload to storage:', {
    fileUniqueId,
    fileType,
    mimeType,
    retryCount
  });

  try {
    const fileName = generateSafeFileName(fileUniqueId, fileType);
    const contentType = mimeType || getMimeType(fileName);

    // Check if file already exists
    const { data: existingFile } = await supabase.storage
      .from('media')
      .list('', {
        search: fileName
      });

    if (existingFile && existingFile.length > 0) {
      console.log('File already exists in storage:', fileName);
      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Verify the public URL is accessible
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Existing file not accessible: ${response.status}`);
        }
        return { publicUrl, storagePath: fileName };
      } catch (error) {
        console.error('Existing file verification failed:', error);
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return uploadMediaToStorage(supabase, buffer, fileUniqueId, fileType, mimeType, retryCount + 1);
        }
        throw error;
      }
    }

    console.log('Uploading file to storage:', {
      fileName,
      contentType,
      bufferSize: buffer.byteLength
    });

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return uploadMediaToStorage(supabase, buffer, fileUniqueId, fileType, mimeType, retryCount + 1);
      }
      throw uploadError;
    }

    // Verify the file exists in storage
    const { data: verifyFile } = await supabase.storage
      .from('media')
      .list('', {
        search: fileName
      });

    if (!verifyFile || verifyFile.length === 0) {
      throw new Error('File upload verification failed');
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error('Failed to get public URL after upload');
    }

    // Verify the public URL is accessible
    const response = await fetch(publicUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`Public URL verification failed: ${response.status}`);
    }

    console.log('Upload successful:', {
      fileName,
      publicUrl,
      verificationStatus: response.status
    });

    return { publicUrl, storagePath: fileName };
  } catch (error) {
    console.error('Error in uploadMediaToStorage:', error);
    
    // Log the error to the media_processing_logs table
    try {
      await supabase
        .from('media_processing_logs')
        .insert({
          file_id: fileUniqueId,
          file_type: fileType,
          error_message: error.message,
          status: 'error',
          retry_count: retryCount
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    throw error;
  }
};