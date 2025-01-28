import { MediaItem } from "@/types/media";

interface MediaAnalysis {
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  analyzed_content?: Record<string, any>;
}

export const getMediaCaption = (media: MediaItem): string => {
  // First try to get caption from message_media_data
  const caption = media.message_media_data?.message?.caption;
  if (caption) return caption;

  // Fallback to direct caption field
  return media.caption || '';
};

export const getProductInfo = (media: MediaItem) => {
  // Extract from message_media_data first
  const analysis = (media.message_media_data?.analysis || {}) as MediaAnalysis;
  
  return {
    name: analysis.product_name || media.product_name || '',
    code: analysis.product_code || media.product_code || '',
    quantity: analysis.quantity || media.quantity || 0,
    vendor: analysis.vendor_uid || media.vendor_uid || '',
    purchaseDate: analysis.purchase_date || media.purchase_date || null,
    notes: analysis.notes || media.notes || ''
  };
};