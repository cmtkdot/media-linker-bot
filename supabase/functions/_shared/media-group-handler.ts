import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { SupabaseClient } from '@supabase/supabase-js';

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

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  text?: string;
  labels?: string[];
}

interface MediaItem {
  id: string;
  file_type: string;
  thumbnail_url?: string;
  telegram_data: {
    media_group_id?: string;
    message_id: number;
    chat_id: number;
    chat?: {
      username?: string;
      type: string;
    };
  };
}

interface MessageRecord {
  id: string;
  message_id: number;
  chat_id: number;
  caption?: string;
  media_group_id?: string;
  processed_at?: string;
}

function getMessageUrl(message: TelegramMessage): string | null {
  if (!message.chat?.username || message.chat.type !== 'channel') {
    return null;
  }
  return `https://t.me/${message.chat.username}/${message.message_id}`;
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
    let analyzedContent: AnalyzedContent | null = null;
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption, supabase);
        console.log('Analyzed content for media group:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Get message URL
    const messageUrl = getMessageUrl(message);

    // Update all media in the group with shared analyzed content
    if (analyzedContent || message.caption) {
      console.log('Updating media group with analyzed content');
      const { error: mediaUpdateError } = await supabase
        .from('telegram_media')
        .update({
          caption: message.caption,
          product_name: analyzedContent?.product_name,
          product_code: analyzedContent?.product_code,
          quantity: analyzedContent?.quantity,
          vendor_uid: analyzedContent?.vendor_uid,
          purchase_date: analyzedContent?.purchase_date,
          notes: analyzedContent?.notes,
          analyzed_content: analyzedContent,
          message_url: messageUrl
        })
        .eq('telegram_data->>media_group_id', message.media_group_id);

      if (mediaUpdateError) {
        console.error('Error updating media records:', mediaUpdateError);
        throw mediaUpdateError;
      }
    }

    return { success: true, media_group_id: message.media_group_id };
  } catch (error) {
    console.error('Error in handleMediaGroup:', error);
    throw error;
  }
}
