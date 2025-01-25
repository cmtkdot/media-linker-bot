import { MediaItem } from "@/types/media";

export function getMediaCaption(item: MediaItem): string | null {
  return item.message_media_data?.message?.caption || null;
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
  const analyzedContent = item.message_media_data?.analysis?.analyzed_content || {};
  return {
    name: analyzedContent.product_name || null,
    code: analyzedContent.product_code || null,
    quantity: analyzedContent.quantity || null,
    vendor: analyzedContent.vendor_uid || null,
    purchaseDate: analyzedContent.purchase_date || null,
    notes: analyzedContent.notes || null
  };
}

export const setMediaCaption = (item: MediaItem, caption: string): MediaItem => {
  return {
    ...item,
    message_media_data: {
      ...item.message_media_data,
      message: {
        ...item.message_media_data.message,
        caption
      }
    }
  };
};