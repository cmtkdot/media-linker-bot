export interface FailedWebhookUpdate {
  id: string;
  message_id?: number;
  chat_id?: number;
  error_message: string;
  error_stack?: string;
  retry_count?: number;
  last_retry_at?: string;
  message_data?: Record<string, any>;
  status?: string;
  created_at: string;
  updated_at: string;
}