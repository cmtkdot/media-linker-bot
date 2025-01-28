import { MediaItem } from "@/types/media";

export function getMediaCaption(item: MediaItem): string | null {
  return item.message_media_data?.message?.caption || null;
}

export function getMediaUrl(item: MediaItem): string {
  return item.message_media_data?.media?.public_url || '';
}

export function getMediaType(item: MediaItem): string {
  return item.message_media_data?.media?.file_type || item.file_type;
}

export function isVideo(item: MediaItem): boolean {
  return getMediaType(item) === 'video';
}

export function isPhoto(item: MediaItem): boolean {
  return getMediaType(item) === 'photo';
}

export function isDocument(item: MediaItem): boolean {
  return getMediaType(item) === 'document';
}

export function parseAnalyzedContent(item: MediaItem) {
  const analysis = item.message_media_data?.analysis || {};
  
  return {
    productName: analysis.product_name || null,
    productCode: analysis.product_code || null,
    quantity: analysis.quantity || null,
    vendorUid: analysis.vendor_uid || null,
    purchaseDate: analysis.purchase_date || null,
    notes: analysis.notes || null
  };
}

export function getProductInfo(item: MediaItem) {
  const analysis = item.message_media_data?.analysis || {};
  
  return {
    name: analysis.product_name || null,
    code: analysis.product_code || null,
    quantity: analysis.quantity || null,
    vendor: analysis.vendor_uid || null,
    purchaseDate: analysis.purchase_date || null,
    notes: analysis.notes || null
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