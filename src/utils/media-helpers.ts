import { MediaItem } from "@/types/media";

export const getMediaCaption = (item: MediaItem): string => {
  return item.message_media_data?.message?.caption || 'Untitled';
};

export const setMediaCaption = (item: MediaItem, caption: string): MediaItem => {
  return {
    ...item,
    message_media_data: {
      ...item.message_media_data,
      message: {
        ...item.message_media_data?.message,
        caption
      }
    }
  };
};