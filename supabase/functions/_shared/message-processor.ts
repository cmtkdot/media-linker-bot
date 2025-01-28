import { analyzeCaptionWithAI } from './caption-analyzer.ts';

interface MessageData {
  message_id: number;
  chat_id: number;
  sender_info: Record<string, any>;
  message_type: string;
  telegram_data: Record<string, any>;
  media_group_id?: string;
  message_url?: string;
  correlation_id?: string;
  is_original_caption?: boolean;
  original_message_id?: string;
  analyzed_content?: Record<string, any>;
  message_media_data?: Record<string, any>;
  caption?: string;
  text?: string;
}

export async function processTextMessage(message: any, messageUrl: string, correlationId: string) {
  console.log('Processing text message:', message.text);
  
  const analyzedContent = await analyzeCaptionWithAI(message.text);
  
  return {
    message_id: message.message_id,
    chat_id: message.chat.id,
    sender_info: message.from || message.sender_chat || {},
    message_type: 'text',
    telegram_data: message,
    message_url: messageUrl,
    correlation_id: correlationId,
    analyzed_content: analyzedContent,
    text: message.text,
    status: 'processed'
  };
}

export async function createMessageMediaData(messageData: MessageData) {
  return {
    message: {
      url: messageData.message_url,
      media_group_id: messageData.media_group_id,
      caption: messageData.caption,
      text: messageData.text,
      message_id: messageData.message_id,
      chat_id: messageData.chat_id,
      date: messageData.telegram_data.date
    },
    sender: {
      sender_info: messageData.sender_info,
      chat_info: messageData.telegram_data.chat
    },
    analysis: {
      analyzed_content: messageData.analyzed_content
    },
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: messageData.message_type === 'text' ? 'processed' : 'pending',
      error: null,
      is_original_caption: messageData.is_original_caption,
      original_message_id: messageData.original_message_id,
      correlation_id: messageData.correlation_id
    }
  };
}