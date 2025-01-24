import { MediaItem } from "@/types/media";

export const getMediaCaption = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.caption;
};

export const getMediaGroupId = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.media_group_id;
};

export const getMessageId = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.message_id;
};

export const getChatId = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.chat?.id;
};