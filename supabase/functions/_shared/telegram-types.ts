export interface TelegramUpdate {
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: any;
  sender_chat?: any;
  chat: any;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  animation?: TelegramAnimation;
  media_group_id?: string;
}

interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}