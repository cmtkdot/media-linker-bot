import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAndDownloadTelegramFile } from "../_shared/telegram-service.ts";
import { uploadMediaToStorage } from "../_shared/storage-manager.ts";
import { validateMediaFile } from "../_shared/media-validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Fetch pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    if (!queueItems?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group items by media_group_id
    const mediaGroups = new Map();
    queueItems.forEach(item => {
      const groupId = item.message_media_data?.message?.media_group_id;
      if (groupId) {
        if (!mediaGroups.has(groupId)) {
          mediaGroups.set(groupId, []);
        }
        mediaGroups.get(groupId).push(item);
      }
    });

    const processedResults = [];

    // Process media groups first
    for (const [groupId, items] of mediaGroups) {
      console.log(`Processing media group ${groupId} with ${items.length} items`);
      
      for (const item of items) {
        const result = await processQueueItem(supabase, item);
        processedResults.push(result);
      }
    }

    // Process remaining individual items
    const individualItems = queueItems.filter(item => 
      !item.message_media_data?.message?.media_group_id
    );

    for (const item of individualItems) {
      const result = await processQueueItem(supabase, item);
      processedResults.push(result);
    }

    // Cleanup processed queue items
    await cleanupProcessedItems(supabase);

    return new Response(
      JSON.stringify({ 
        processed: processedResults.length,
        results: processedResults 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function processQueueItem(supabase: any, item: any) {
  console.log(`Processing queue item ${item.id}`);
  
  try {
    const fileId = item.message_media_data?.media?.file_id;
    const fileUniqueId = item.message_media_data?.media?.file_unique_id;
    const fileType = item.message_media_data?.media?.file_type;

    if (!fileId || !fileUniqueId || !fileType) {
      throw new Error('Missing required media information');
    }

    // Check for existing media with same file_unique_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia) {
      // Compare message_media_data for changes
      const hasChanges = compareMediaData(existingMedia.message_media_data, item.message_media_data);
      
      if (hasChanges) {
        // Update existing record with new data
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
            message_media_data: item.message_media_data,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMedia.id);

        if (updateError) throw updateError;
      }

      // Mark queue item as processed
      await markQueueItemProcessed(supabase, item.id);
      return { id: item.id, status: 'updated', file_unique_id: fileUniqueId };
    }

    // Validate and process new media file
    await validateMediaFile(item.message_media_data?.media, fileType);

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Download and upload file
    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);
    const fileExt = filePath.split('.').pop() || '';
    
    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileExt,
      fileType === 'video' ? {
        maxSize: 50 * 1024 * 1024,
        compress: true
      } : undefined
    );

    // Update message_media_data with public URL
    const updatedMessageMediaData = {
      ...item.message_media_data,
      media: {
        ...item.message_media_data.media,
        public_url: publicUrl
      }
    };

    // Create telegram_media record
    const { error: insertError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: fileId,
        file_unique_id: fileUniqueId,
        file_type: fileType,
        public_url: publicUrl,
        message_media_data: updatedMessageMediaData,
        message_id: item.message_media_data?.message?.message_id,
        caption: item.message_media_data?.message?.caption
      });

    if (insertError) throw insertError;

    // Mark queue item as processed
    await markQueueItemProcessed(supabase, item.id);
    return { id: item.id, status: 'processed', file_unique_id: fileUniqueId };

  } catch (error) {
    console.error(`Error processing queue item ${item.id}:`, error);
    
    // Update queue item with error
    const { error: updateError } = await supabase
      .from('unified_processing_queue')
      .update({
        status: 'failed',
        error_message: error.message,
        processed_at: new Date().toISOString(),
        retry_count: (item.retry_count || 0) + 1
      })
      .eq('id', item.id);

    if (updateError) {
      console.error('Error updating queue item status:', updateError);
    }

    return { id: item.id, status: 'failed', error: error.message };
  }
}

function compareMediaData(existing: any, updated: any): boolean {
  // Compare relevant fields for changes
  const fieldsToCompare = ['message.caption', 'analysis.analyzed_content'];
  
  for (const field of fieldsToCompare) {
    const parts = field.split('.');
    const existingValue = parts.reduce((obj, key) => obj?.[key], existing);
    const updatedValue = parts.reduce((obj, key) => obj?.[key], updated);
    
    if (JSON.stringify(existingValue) !== JSON.stringify(updatedValue)) {
      return true;
    }
  }
  
  return false;
}

async function markQueueItemProcessed(supabase: any, itemId: string) {
  const { error } = await supabase
    .from('unified_processing_queue')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString()
    })
    .eq('id', itemId);

  if (error) {
    console.error('Error marking queue item as processed:', error);
    throw error;
  }
}

async function cleanupProcessedItems(supabase: any) {
  // Delete processed items older than 24 hours
  const { error } = await supabase
    .from('unified_processing_queue')
    .delete()
    .eq('status', 'processed')
    .lt('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Error cleaning up processed items:', error);
  }
}