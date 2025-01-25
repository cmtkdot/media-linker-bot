import { MediaItem } from "@/types/media";

export function getMediaCaption(item: MediaItem): string | null {
  return item.caption || null;
}

export function getMediaUrl(item: MediaItem): string {
  return item.public_url;
}

export function getMediaType(item: MediaItem): string {
  return item.file_type;
}

export function isVideo(item: MediaItem): boolean {
  return item.file_type === 'video';
}

export function isPhoto(item: MediaItem): boolean {
  return item.file_type === 'photo';
}

export function isDocument(item: MediaItem): boolean {
  return item.file_type === 'document';
}

export function getProductInfo(item: MediaItem) {
  return {
    name: item.analyzed_content?.product_name || null,
    code: item.analyzed_content?.product_code || null,
    quantity: item.analyzed_content?.quantity || null,
    vendor: item.analyzed_content?.vendor_uid || null,
    purchaseDate: item.analyzed_content?.purchase_date || null,
    notes: item.analyzed_content?.notes || null
  };
}

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