export interface MessageMediaData {
  message: {
    url: string;
    media_group_id?: string;
    caption?: string;
    message_id: number;
    chat_id: number;
    date: number;
  };
  sender: {
    sender_info: Record<string, any>;
    chat_info: Record<string, any>;
  };
  analysis: {
    analyzed_content: Record<string, any>;
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: 'pending' | 'processed' | 'error';
    error: string | null;
  };
  media: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url: string | null;
  };
  telegram_data?: Record<string, any>;
}