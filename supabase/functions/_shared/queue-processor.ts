import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateMediaFile } from "./media-validators.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";

interface QueueItem {
  id: string;
  message_media_data: {
    message: {
      media_group_id?: string;
      message_id: number;
    };
    media: {
      file_id: string;
      file_unique_id: string;
      file_type: string;
    };
  };
}

export async function processMediaGroups(supabase: any, items: QueueItem[]) {
  const mediaGroups = new Map<string, QueueItem[]>();
  
  // Group items by media_group_id
  items.forEach(item => {
    const groupId = item.message_media_data?.message?.media_group_id;
    if (groupId) {
      if (!mediaGroups.has(groupId)) {
        mediaGroups.set(groupId, []);
      }
      mediaGroups.get(groupId)?.push(item);
    }
  });

  console.log(`Processing ${mediaGroups.size} media groups`);

  for (const [groupId, groupItems] of mediaGroups) {
    console.log(`Processing media group ${groupId} with ${groupItems.length} items`);
    await processMediaGroup(supabase, groupId, groupItems);
  }
}

async function processMediaGroup(supabase: any, groupId: string, items: QueueItem[]) {
  try {
    // Process all items in the group
    for (const item of items) {
      await processQueueItem(supabase, item);
    }
  } catch (error) {
    console.error(`Error processing media group ${groupId}:`, error);
    throw error;
  }
}

export async function processQueueItem(supabase: any, item: QueueItem) {
  console.log(`Processing queue item for message ${item.message_media_data.message.message_id}`);

  try {
    const fileId = item.message_media_data.media.file_id;
    const fileUniqueId = item.message_media_data.media.file_unique_id;
    const fileType = item.message_media_data.media.file_type;

    // Check for existing media
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .single();

    if (existingMedia) {
      return await handleExistingMedia(supabase, existingMedia, item);
    }

    // Process new media
    await validateMediaFile(item.message_media_data.media, fileType);
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);
    const fileExt = filePath.split('.').pop() || '';
    
    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileExt
    );

    // Create new telegram_media record
    await createTelegramMediaRecord(supabase, item, publicUrl);
    
    // Mark queue item as processed
    await markQueueItemProcessed(supabase, item.id);

    return { status: 'processed', file_unique_id: fileUniqueId };
  } catch (error) {
    console.error(`Error processing queue item:`, error);
    await handleProcessingError(supabase, item.id, error);
    throw error;
  }
}

async function handleExistingMedia(supabase: any, existingMedia: any, item: QueueItem) {
  console.log(`Found existing media for ${item.message_media_data.media.file_unique_id}`);
  
  const hasChanges = compareMediaData(existingMedia.message_media_data, item.message_media_data);
  
  if (hasChanges) {
    console.log(`Updating existing media record with new data`);
    await updateExistingMedia(supabase, existingMedia.id, item);
  }

  await markQueueItemProcessed(supabase, item.id);
  return { status: 'updated', file_unique_id: item.message_media_data.media.file_unique_id };
}

function compareMediaData(existing: any, updated: any): boolean {
  const fieldsToCompare = [
    'message.caption',
    'analysis.analyzed_content',
    'meta.is_original_caption'
  ];
  
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

async function createTelegramMediaRecord(supabase: any, item: QueueItem, publicUrl: string) {
  const { error: insertError } = await supabase
    .from('telegram_media')
    .insert({
      file_id: item.message_media_data.media.file_id,
      file_unique_id: item.message_media_data.media.file_unique_id,
      file_type: item.message_media_data.media.file_type,
      public_url: publicUrl,
      message_media_data: {
        ...item.message_media_data,
        media: {
          ...item.message_media_data.media,
          public_url: publicUrl
        }
      }
    });

  if (insertError) throw insertError;
}

async function updateExistingMedia(supabase: any, id: string, item: QueueItem) {
  const { error: updateError } = await supabase
    .from('telegram_media')
    .update({
      message_media_data: item.message_media_data,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) throw updateError;
}

async function markQueueItemProcessed(supabase: any, itemId: string) {
  const { error } = await supabase
    .from('unified_processing_queue')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString()
    })
    .eq('id', itemId);

  if (error) throw error;
}

async function handleProcessingError(supabase: any, itemId: string, error: any) {
  const { error: updateError } = await supabase
    .from('unified_processing_queue')
    .update({
      status: 'error',
      error_message: error.message,
      processed_at: new Date().toISOString()
    })
    .eq('id', itemId);

  if (updateError) {
    console.error('Error updating queue item status:', updateError);
  }
}