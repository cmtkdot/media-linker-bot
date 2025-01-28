import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateMediaFile } from "./media-validators.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";

interface QueueItem {
  id: string;
  message_media_data: {
    message: {
      message_id: number;
      media_group_id?: string;
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

async function isMediaGroupComplete(supabase: any, mediaGroupId: string): Promise<boolean> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, analyzed_content')
    .eq('media_group_id', mediaGroupId);

  if (error) {
    console.error('Error checking media group completeness:', error);
    return false;
  }

  return messages.every(msg => msg.analyzed_content !== null);
}

async function waitForMediaGroupCompletion(supabase: any, mediaGroupId: string, maxAttempts = 5): Promise<boolean> {
  console.log(`Waiting for media group ${mediaGroupId} to complete...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isComplete = await isMediaGroupComplete(supabase, mediaGroupId);
    
    if (isComplete) {
      console.log(`Media group ${mediaGroupId} is complete after ${attempt + 1} attempts`);
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`Media group ${mediaGroupId} incomplete after ${maxAttempts} attempts`);
  return false;
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

    const analyzedContent = originalItem?.message_media_data?.analysis?.analyzed_content;

    console.log('Processing media group:', {
      group_id: groupId,
      items_count: items.length,
      has_original_caption: !!originalItem,
      has_analyzed_content: !!analyzedContent
    });

    for (const item of items) {
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

    // Check if media already exists
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia) {
      console.log(`Media ${fileUniqueId} already exists, updating analyzed content`);
      
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: item.message_media_data.analysis.analyzed_content,
          original_message_id: originalItem?.id,
          is_original_caption: item.message_media_data.meta.is_original_caption,
          message_media_data: item.message_media_data
        })
        .eq('id', existingMedia.id);

      if (updateError) throw updateError;
      return;
    }

    // Process new media file
    await validateMediaFile(item.message_media_data.media, fileType);
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Download and upload file
    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);
    const fileExt = filePath.split('.').pop() || '';
    
    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileExt
    );

    // Create media record
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
      original_message_id: originalItem?.id,
      analyzed_content: item.message_media_data.analysis.analyzed_content
    };

    const { error: insertError } = await supabase
      .from('telegram_media')
      .insert([mediaData]);

    if (insertError) throw insertError;

    console.log(`Successfully processed media item ${fileUniqueId}`);
  } catch (error) {
    console.error(`Error processing queue item:`, error);
    throw error;
  }
}