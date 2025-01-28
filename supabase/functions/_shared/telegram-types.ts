export interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_name?: string;
  mime_type?: string;
}

export interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  animation?: TelegramAnimation;
  media_group_id?: string;
  sender_chat?: Record<string, unknown>;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}
