export interface GlideTableSchema {
  id: { type: "string"; name: "UkkMS" };
  file_id: { type: "string"; name: "9Bod8" };
  file_unique_id: { type: "string"; name: "IYnip" };
  file_type: { type: "string"; name: "hbjE4" };
  public_url: { type: "uri"; name: "d8Di5" };
  product_name: { type: "string"; name: "xGGv3" };
  product_code: { type: "string"; name: "xlfB9" };
  quantity: { type: "number"; name: "TWRwx" };
  telegram_data: { type: "string"; name: "Wm1he" };
  glide_data: { type: "string"; name: "ZRV7Z" };
  media_metadata: { type: "string"; name: "Eu9Zn" };
  processed: { type: "boolean"; name: "oj7fP" };
  processing_error: { type: "string"; name: "A4sZX" };
  last_synced_at: { type: "string"; name: "PWhCr" };
  created_at: { type: "string"; name: "Oa3L9" };
  updated_at: { type: "string"; name: "9xwrl" };
  message_id: { type: "string"; name: "Uzkgt" };
  caption: { type: "string"; name: "pRsjz" };
  vendor_uid: { type: "string"; name: "uxDo1" };
  purchase_date: { type: "date"; name: "AMWxJ" };
  notes: { type: "string"; name: "BkUFO" };
  analyzed_content: { type: "string"; name: "QhAgy" };
  purchase_order_uid: { type: "string"; name: "3y8Wt" };
  default_public_url: { type: "uri"; name: "rCJK2" };
  telegram_media_row_id: { type: "string"; name: "rowID" };
  media_json: { type: "string"; name: "NL5gM" };
}

export interface TelegramMedia {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  processed?: boolean;
  processing_error?: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
  message_id?: string;
  caption?: string;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
  purchase_order_uid?: string;
  default_public_url?: string;
  telegram_media_row_id?: string;
}

export interface GlideSyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  created_at?: string;
  processed_at?: string | null;
  error?: string | null;
  retry_count?: number;
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface GlideConfig {
  id: string;
  app_id: string;
  table_id: string;
  table_name: string;
  api_token: string;
  created_at: string;
  updated_at: string;
  active: boolean;
  supabase_table_name: string;
}

export interface GlideResponse {
  rowIDs?: string[];
  error?: string;
}

export interface WebhookUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  animation?: TelegramAnimation;
  media_group_id?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}