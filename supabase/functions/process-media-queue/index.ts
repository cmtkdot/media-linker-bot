import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAndDownloadTelegramFile } from "../_shared/telegram-service.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    console.log(`Processing ${queueItems?.length || 0} queue items`);

    const results = {
      processed: 0,
      errors: 0,
      details: [] as any[]
    };

    // Group items by media_group_id for batch processing
    const mediaGroups = new Map<string, any[]>();
    const standaloneItems = [];

    for (const item of queueItems || []) {
      if (item.queue_type !== 'media') continue;
      
      const mediaGroupId = item.data?.message?.media_group_id;
      if (mediaGroupId) {
        if (!mediaGroups.has(mediaGroupId)) {
          mediaGroups.set(mediaGroupId, []);
        }
        mediaGroups.get(mediaGroupId)?.push(item);
      } else {
        standaloneItems.push(item);
      }
    }

    // Process media groups first
    for (const [groupId, items] of mediaGroups.entries()) {
      try {
        // Find the caption holder (item with analyzed content)
        const captionHolder = items.find(item => 
          item.data?.analysis?.analyzed_content || 
          item.data?.message?.caption
        );

        if (!captionHolder) {
          console.log(`No caption holder found for group ${groupId}`);
          continue;
        }

        // Get the shared analyzed content and message data
        const sharedAnalyzedContent = captionHolder.data.analysis.analyzed_content;
        const sharedMessageData = captionHolder.data.message;

        // Update all items in the group with shared data
        for (const item of items) {
          try {
            // Update queue item data with shared content
            const updatedData = {
              ...item.data,
              message: {
                ...item.data.message,
                caption: sharedMessageData.caption,
                media_group_id: groupId
              },
              analysis: {
                analyzed_content: sharedAnalyzedContent
              }
            };

            // Update queue item
            await supabase
              .from('unified_processing_queue')
              .update({ 
                data: updatedData,
                status: 'processing'
              })
              .eq('id', item.id);

            // Process media file
            const mediaFile = item.data.telegram_data?.photo?.[0] || 
                            item.data.telegram_data?.video || 
                            item.data.telegram_data?.document;

            if (!mediaFile) {
              throw new Error('No media file found');
            }

            // Download and upload to storage
            const { buffer, filePath } = await getAndDownloadTelegramFile(
              mediaFile.file_id, 
              TELEGRAM_BOT_TOKEN
            );

            const fileExt = filePath.split('.').pop() || '';
            const fileName = `${mediaFile.file_unique_id}.${fileExt}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(fileName, buffer, {
                contentType: item.data.file_type === 'photo' ? 'image/jpeg' : 'video/mp4',
                upsert: true
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = await supabase.storage
              .from('media')
              .getPublicUrl(fileName);

            // Insert into telegram_media
            const { error: insertError } = await supabase
              .from('telegram_media')
              .insert([{
                file_id: mediaFile.file_id,
                file_unique_id: mediaFile.file_unique_id,
                file_type: item.data.file_type,
                public_url: publicUrl,
                message_id: item.message_id,
                analyzed_content: sharedAnalyzedContent,
                telegram_data: item.data.telegram_data,
                message_media_data: updatedData,
                caption: sharedMessageData.caption,
                product_name: sharedAnalyzedContent?.product_name,
                product_code: sharedAnalyzedContent?.product_code,
                quantity: sharedAnalyzedContent?.quantity,
                vendor_uid: sharedAnalyzedContent?.vendor_uid,
                purchase_date: sharedAnalyzedContent?.purchase_date,
                notes: sharedAnalyzedContent?.notes
              }]);

            if (insertError) throw insertError;

            // Mark queue item as completed
            await supabase
              .from('unified_processing_queue')
              .update({ 
                status: 'completed',
                processed_at: new Date().toISOString()
              })
              .eq('id', item.id);

            results.processed++;

          } catch (error) {
            console.error(`Error processing group item ${item.id}:`, error);
            results.errors++;
            await updateQueueItemStatus(supabase, item.id, 'error', error.message);
          }
        }

      } catch (error) {
        console.error(`Error processing media group ${groupId}:`, error);
        results.errors += items.length;
        for (const item of items) {
          await updateQueueItemStatus(supabase, item.id, 'error', error.message);
        }
      }
    }

    // Process standalone items
    for (const item of standaloneItems) {
      try {
        await processStandaloneItem(supabase, item);
        results.processed++;
      } catch (error) {
        console.error(`Error processing standalone item ${item.id}:`, error);
        results.errors++;
        await updateQueueItemStatus(supabase, item.id, 'error', error.message);
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in queue processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function processStandaloneItem(supabase: any, item: any) {
  // Update status to processing
  await supabase
    .from('unified_processing_queue')
    .update({ status: 'processing' })
    .eq('id', item.id);

  const mediaFile = item.data.telegram_data?.photo?.[0] || 
                   item.data.telegram_data?.video || 
                   item.data.telegram_data?.document;

  if (!mediaFile) {
    throw new Error('No media file found');
  }

  // Download and upload to storage
  const { buffer, filePath } = await getAndDownloadTelegramFile(
    mediaFile.file_id, 
    TELEGRAM_BOT_TOKEN
  );

  const fileExt = filePath.split('.').pop() || '';
  const fileName = `${mediaFile.file_unique_id}.${fileExt}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, buffer, {
      contentType: item.data.file_type === 'photo' ? 'image/jpeg' : 'video/mp4',
      upsert: true
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = await supabase.storage
    .from('media')
    .getPublicUrl(fileName);

  // Insert into telegram_media
  const { error: insertError } = await supabase
    .from('telegram_media')
    .insert([{
      file_id: mediaFile.file_id,
      file_unique_id: mediaFile.file_unique_id,
      file_type: item.data.file_type,
      public_url: publicUrl,
      message_id: item.message_id,
      analyzed_content: item.data.analysis?.analyzed_content,
      telegram_data: item.data.telegram_data,
      message_media_data: item.data,
      caption: item.data.message?.caption,
      product_name: item.data.analysis?.analyzed_content?.product_name,
      product_code: item.data.analysis?.analyzed_content?.product_code,
      quantity: item.data.analysis?.analyzed_content?.quantity,
      vendor_uid: item.data.analysis?.analyzed_content?.vendor_uid,
      purchase_date: item.data.analysis?.analyzed_content?.purchase_date,
      notes: item.data.analysis?.analyzed_content?.notes
    }]);

  if (insertError) throw insertError;

  // Mark as completed
  await supabase
    .from('unified_processing_queue')
    .update({ 
      status: 'completed',
      processed_at: new Date().toISOString()
    })
    .eq('id', item.id);
}

async function updateQueueItemStatus(
  supabase: any, 
  itemId: string, 
  status: 'processing' | 'completed' | 'error', 
  errorMessage?: string
) {
  const updates: any = {
    status,
    processed_at: status === 'completed' ? new Date().toISOString() : null
  };

  if (status === 'error') {
    updates.error_message = errorMessage;
    updates.retry_count = supabase.sql`retry_count + 1`;
  }

  const { error } = await supabase
    .from('unified_processing_queue')
    .update(updates)
    .eq('id', itemId);

  if (error) {
    console.error('Error updating queue item status:', error);
    throw error;
  }
}