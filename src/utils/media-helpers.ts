import { MediaItem } from "@/types/media";

export const getMediaCaption = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.caption;
};

export const getMediaGroupId = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.media_group_id;
};

export const getMessageId = (item: MediaItem): number | undefined => {
  return item.telegram_data?.message_data?.message_id;
};

export const getChatId = (item: MediaItem): number | undefined => {
  return item.telegram_data?.message_data?.chat?.id;
};

export const getPhotoSizes = (item: MediaItem): { width: number; height: number; }[] | undefined => {
  return item.telegram_data?.message_data?.photo;
};

export const getLargestPhoto = (item: MediaItem): { width: number; height: number; file_id: string; } | undefined => {
  const photos = item.telegram_data?.message_data?.photo;
  if (!photos?.length) return undefined;
  return photos.reduce((largest, current) => 
    current.width > largest.width ? current : largest
  );
};

export const getVideoThumbnail = (item: MediaItem): { file_id: string; file_unique_id: string; } | undefined => {
  return item.telegram_data?.message_data?.video?.thumb;
};

export const getChatTitle = (item: MediaItem): string | undefined => {
  return item.telegram_data?.message_data?.chat?.title;
};