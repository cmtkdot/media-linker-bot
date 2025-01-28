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
    meta: {
      is_original_caption: boolean;
      original_message_id?: string;
    };
    analysis: {
      analyzed_content: any;
    };
  };
}

export async function processMediaGroups(supabase: any, items: QueueItem[]) {
  const mediaGroups = new Map<string, QueueItem[]>();
  
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
    const originalItem = items.find(item => 
      item.message_media_data?.meta?.is_original_caption
    );

    // Get analyzed content from original item
    const analyzedContent = originalItem?.message_media_data?.analysis?.analyzed_content;

    // Process each item in the group
    for (const item of items) {
      // Update item's analyzed content from original
      if (analyzedContent && !item.message_media_data?.meta?.is_original_caption) {
        item.message_media_data.analysis.analyzed_content = analyzedContent;
      }
      await processQueueItem(supabase, item, originalItem);
    }
  } catch (error) {
    console.error(`Error processing media group ${groupId}:`, error);
    throw error;
  }
}

export async function processQueueItem(supabase: any, item: QueueItem, originalItem?: QueueItem) {
  console.log(`Processing queue item for message ${item.message_media_data.message.message_id}`);

  try {
    const fileId = item.message_media_data.media.file_id;
    const fileUniqueId = item.message_media_data.media.file_unique_id;
    const fileType = item.message_media_data.media.file_type;

    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia) {
      console.log(`Media ${fileUniqueId} already exists, updating analyzed content`);
      
      // Update existing media with latest analyzed content
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: item.message_media_data.analysis.analyzed_content,
          original_message_id: originalItem?.message_media_data?.meta?.original_message_id,
          message_media_data: item.message_media_data
        })
        .eq('id', existingMedia.id);

      if (updateError) throw updateError;
      return;
    }

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

    const mediaData = {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: fileType,
      public_url: publicUrl,
      message_media_data: {
        ...item.message_media_data,
        media: {
          ...item.message_media_data.media,
          public_url: publicUrl
        }
      },
      is_original_caption: item.message_media_data.meta.is_original_caption,
      original_message_id: originalItem?.message_media_data?.meta?.original_message_id,
      analyzed_content: item.message_media_data.analysis.analyzed_content
    };

    const { error: insertError } = await supabase
      .from('telegram_media')
      .insert([mediaData]);

    if (insertError) throw insertError;

    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    console.log(`Successfully processed media item ${fileUniqueId}`);
  } catch (error) {
    console.error(`Error processing queue item:`, error);
    
    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'error',
        error_message: error.message,
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    throw error;
  }
}