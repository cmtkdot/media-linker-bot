import { MediaItem } from "@/types/media";

export const getMediaCaption = (media: MediaItem): string => {
  // First try to get caption from message_media_data
  const caption = media.message_media_data?.message?.caption;
  if (caption) return caption;

  // Fallback to direct caption field
  return media.caption || '';
};

export const getProductInfo = (media: MediaItem) => {
  // Extract from message_media_data first
  const analysis = media.message_media_data?.analysis || {};
  
  return {
    name: analysis.product_name as string || media.product_name || '',
    code: analysis.product_code as string || media.product_code || '',
    quantity: analysis.quantity as number || media.quantity || 0,
    vendor: analysis.vendor_uid as string || media.vendor_uid || '',
    purchaseDate: analysis.purchase_date as string || media.purchase_date || null,
    notes: analysis.notes as string || media.notes || ''
  };
};