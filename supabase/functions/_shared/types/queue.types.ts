export interface QueueItem {
  id: string;
  queue_type: 'media' | 'media_group' | 'webhook';
  message_media_data: MessageMediaData;
  status: 'pending' | 'processing' | 'processed' | 'error';
  error_message?: string;
  retry_count: number;
  max_retries: number;
  priority: number;
  created_at: string;
  processed_at?: string;
  correlation_id: string;
}

export interface ProcessingResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}