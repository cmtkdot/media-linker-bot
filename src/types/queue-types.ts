import { MessageMediaData } from './media-types';

export interface QueueItem {
  id: string;
  queue_type: 'media' | 'webhook' | 'media_group';
  message_media_data: MessageMediaData;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  correlation_id: string;
}

export interface ProcessingResult {
  success: boolean;
  error?: string;
  mediaId?: string;
}