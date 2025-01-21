export interface TelegramWebhookUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  media_group_id?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  animation?: TelegramAnimation;
  date: number;
}

interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
}

interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}