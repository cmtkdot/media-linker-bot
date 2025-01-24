import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TelegramMessage {
  media_group_id?: string;
  caption?: string;
  message_id: number;
  chat: {
    id: number;
    username?: string;
    type: string;
  };
  date: number;
}

interface MessageRecord {
  id: string;
  message_id: number;
  chat_id: number;
  caption?: string;
  media_group_id?: string;
  processed_at?: string;
}

export async function handleMediaGroup(
  supabase: SupabaseClient,
  message: TelegramMessage,
  messageRecord: MessageRecord
) {
  if (!message.media_group_id) return null;

  console.log('Processing media group:', message.media_group_id);
  
  try {
    // First analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        console.log('Analyzing caption for media group:', {
          media_group_id: message.media_group_id,
          caption: message.caption
        });
        
        analyzedContent = await analyzeCaptionWithAI(message.caption);
        console.log('Analyzed content for media group:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Update all media in the group with shared analyzed content
    if (analyzedContent) {
      console.log('Updating media group with analyzed content:', {
        media_group_id: message.media_group_id
      });

      const { error: mediaUpdateError } = await supabase
        .from('telegram_media')
        .update({
          caption: message.caption,
          analyzed_content: analyzedContent,
          product_name: analyzedContent.product_name,
          product_code: analyzedContent.product_code,
          quantity: analyzedContent.quantity,
          vendor_uid: analyzedContent.vendor_uid,
          purchase_date: analyzedContent.purchase_date,
          notes: analyzedContent.notes
        })
        .eq('telegram_data->media_group_id', message.media_group_id);

      if (mediaUpdateError) {
        console.error('Error updating media records:', mediaUpdateError);
        throw mediaUpdateError;
      }

      console.log('Successfully updated media group:', {
        media_group_id: message.media_group_id,
        caption: message.caption?.substring(0, 50) + '...'
      });
    }

    return { success: true, media_group_id: message.media_group_id };
  } catch (error) {
    console.error('Error in handleMediaGroup:', error);
    throw error;
  }
}