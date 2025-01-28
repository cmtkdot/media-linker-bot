export interface QueueItem {
  id: string;
  queue_type: 'media' | 'webhook' | 'media_group';
  message_media_data: {
    message: {
      media_group_id?: string;
      message_id: number;
      chat_id: number;
      caption?: string;
      url?: string;
      date: number;
    };
    media: {
      file_id: string;
      file_unique_id: string;
      file_type: string;
      public_url?: string;
      storage_path?: string;
    };
    meta: {
      is_original_caption: boolean;
      original_message_id?: string;
      status?: string;
      error?: string | null;
      processed_at?: string;
      retry_count?: number;
    };
    analysis: {
      analyzed_content: any;
      product_name?: string;
      product_code?: string;
      quantity?: number;
      vendor_uid?: string;
      purchase_date?: string;
      notes?: string;
    };
    sender: {
      sender_info: Record<string, any>;
      chat_info: Record<string, any>;
    };
    telegram_data: Record<string, any>;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  correlation_id: string;
}

export interface ProcessingResult {
  success: boolean;
  error?: string;
  mediaId?: string;
}