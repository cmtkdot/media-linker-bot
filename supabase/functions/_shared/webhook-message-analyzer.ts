import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { TelegramMessage } from './telegram-types.ts';

export interface AnalyzedMessageContent {
  analyzed_content: Record<string, any>;
  is_original_caption: boolean;
  original_message_id: string | null;
}

export async function analyzeWebhookMessage(
  message: TelegramMessage,
  existingGroupMessages?: any[]
): Promise<AnalyzedMessageContent> {
  console.log('Analyzing webhook message:', {
    message_id: message.message_id,
    has_caption: !!message.caption,
    media_group_id: message.media_group_id,
    message_type: message.photo ? 'photo' : message.video ? 'video' : 'other',
    existing_messages_count: existingGroupMessages?.length
  });

  // If message is part of a media group
  if (message.media_group_id && existingGroupMessages?.length) {
    const existingCaptionHolder = existingGroupMessages.find(m => m.is_original_caption);
    
    if (existingCaptionHolder) {
      console.log('Using existing caption holder:', {
        original_message_id: existingCaptionHolder.id,
        has_analyzed_content: !!existingCaptionHolder.analyzed_content,
        message_type: existingCaptionHolder.message_type
      });
      
      return {
        analyzed_content: existingCaptionHolder.analyzed_content,
        is_original_caption: false,
        original_message_id: existingCaptionHolder.id
      };
    }
  }

  // This message will be the caption holder if it has a caption
  if (message.caption) {
    console.log('Analyzing new caption:', {
      caption: message.caption,
      message_type: message.photo ? 'photo' : message.video ? 'video' : 'other'
    });

    const analyzed_content = await analyzeCaptionWithAI(message.caption);
    console.log('Caption analysis result:', {
      has_analyzed_content: !!analyzed_content,
      extracted_data: analyzed_content?.analyzed_content?.extracted_data
    });

    return {
      analyzed_content,
      is_original_caption: true,
      original_message_id: null
    };
  }

  return {
    analyzed_content: null,
    is_original_caption: false,
    original_message_id: null
  };
}