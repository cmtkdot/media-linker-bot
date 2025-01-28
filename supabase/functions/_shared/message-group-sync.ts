import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function processMessageContent(
  supabase: any,
  message: any,
  mediaGroupId: string | null,
  analyzedContent: any,
  isOriginalCaption: boolean,
  correlationId: string
) {
  try {
    if (!mediaGroupId) {
      return { isOriginalCaption, originalMessageId: null };
    }

    // Get existing messages in the group
    const { data: existingMessages } = await supabase
      .from('messages')
      .select('id, is_original_caption, analyzed_content, caption')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });

    let originalMessageId = null;
    
    if (message.caption) {
      // If this message has a caption, check if there's already an original caption holder
      const existingCaptionHolder = existingMessages?.find(m => m.is_original_caption);
      
      if (!existingCaptionHolder) {
        // This becomes the original caption holder
        isOriginalCaption = true;
        
        // Update all existing messages in the group with the analyzed content
        if (existingMessages?.length > 0) {
          await supabase
            .from('messages')
            .update({
              analyzed_content: analyzedContent,
              original_message_id: null // Will be updated after current message insert
            })
            .eq('media_group_id', mediaGroupId);
        }
      } else {
        // Use existing caption holder's ID and content
        originalMessageId = existingCaptionHolder.id;
        analyzedContent = existingCaptionHolder.analyzed_content;
      }
    } else if (existingMessages?.length > 0) {
      // For non-caption messages, use existing analyzed content if available
      const existingCaptionHolder = existingMessages.find(m => m.is_original_caption);
      if (existingCaptionHolder) {
        originalMessageId = existingCaptionHolder.id;
        analyzedContent = existingCaptionHolder.analyzed_content;
      }
    }

    return {
      isOriginalCaption,
      originalMessageId,
      analyzedContent
    };
  } catch (error) {
    console.error('Error processing message content:', error);
    throw error;
  }
}