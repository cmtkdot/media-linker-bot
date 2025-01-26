import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const withDatabaseRetry = async <T>(
  operation: () => Promise<T>,
  retryCount = 0,
  operationName = 'database_operation',
  maxRetries = 3
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${operationName}:`, {
      error: error.message,
      retry_count: retryCount
    });

    if (retryCount >= maxRetries) {
      throw error;
    }

    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
    return withDatabaseRetry(operation, retryCount + 1, operationName, maxRetries);
  }
};

export const uploadToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> => {
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = await supabase.storage
    .from('media')
    .getPublicUrl(fileName);

  return publicUrl;
};

export const generateSafeFileName = (fileUniqueId: string, fileType: string): string => {
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
};

export const analyzeCaptionWithAI = async (
  caption: string,
  supabaseClient?: any
): Promise<any> => {
  try {
    const supabase = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
    
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    throw error;
  }
};

export const handleProcessingError = async (
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number,
  isFinalRetry: boolean
): Promise<{ shouldContinue: boolean }> => {
  console.error('Processing error:', {
    error: error.message,
    message_id: messageRecord.id,
    retry_count: retryCount
  });

  const { error: updateError } = await supabase
    .from('messages')
    .update({
      processing_error: error.message,
      retry_count: retryCount,
      last_retry_at: new Date().toISOString(),
      status: isFinalRetry ? 'error' : 'pending'
    })
    .eq('id', messageRecord.id);

  if (updateError) {
    console.error('Error updating message status:', updateError);
  }

  return { shouldContinue: !isFinalRetry };
};