import { MessageMediaData } from './message-media';

export interface QueueItem {
  id: string;
  queue_type: 'webhook' | 'media' | 'media_group';
  data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
  retry_count: number;
  max_retries: number;
  priority: number;
  created_at: string;
  processed_at?: string | null;
  correlation_id: string;
  chat_id?: number;
  message_id?: number;
  message_media_data: MessageMediaData;
}