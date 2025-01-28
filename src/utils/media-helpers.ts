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

export function parseAnalyzedContent(item: MediaItem) {
  const analyzedContent = item.analyzed_content?.extracted_data || {};
  
  return {
    productName: analyzedContent.product_name || null,
    productCode: analyzedContent.product_code || null,
    quantity: analyzedContent.quantity || null,
    vendorUid: analyzedContent.vendor_uid || null,
    purchaseDate: analyzedContent.purchase_date || null,
    notes: analyzedContent.notes || null
  };
}

export function getProductInfo(item: MediaItem) {
  const analyzedContent = item.message_media_data?.analysis?.analyzed_content || {};
  const extractedData = analyzedContent.extracted_data || {};
  
  return {
    name: extractedData.product_name || null,
    code: extractedData.product_code || null,
    quantity: extractedData.quantity || null,
    vendor: extractedData.vendor_uid || null,
    purchaseDate: extractedData.purchase_date || null,
    notes: extractedData.notes || null
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