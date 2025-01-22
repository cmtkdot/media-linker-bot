import { GlideTableSchema, TelegramMedia } from './types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  const schema = GlideTableSchema;
  const mappedData: Record<string, any> = {};

  // Map fields according to schema
  mappedData[schema.id.name] = supabaseRow.id;
  mappedData[schema.fileType.name] = supabaseRow.file_type;
  mappedData[schema.publicUrl.name] = supabaseRow.public_url;
  mappedData[schema.productName.name] = supabaseRow.product_name;
  mappedData[schema.productCode.name] = supabaseRow.product_code;
  mappedData[schema.quantity.name] = supabaseRow.quantity;
  mappedData[schema.lastSyncedAt.name] = new Date().toISOString();
  mappedData[schema.caption.name] = supabaseRow.caption;
  mappedData[schema.vendorUid.name] = supabaseRow.vendor_uid;
  mappedData[schema.purchaseDate.name] = supabaseRow.purchase_date;
  mappedData[schema.notes.name] = supabaseRow.notes;
  mappedData[schema.analyzedContent.name] = JSON.stringify(supabaseRow.analyzed_content);
  mappedData[schema.purchaseOrderUid.name] = supabaseRow.purchase_order_uid;
  mappedData[schema.defaultPublicUrl.name] = supabaseRow.default_public_url;
  mappedData[schema.mediaJson.name] = JSON.stringify({
    telegram_data: supabaseRow.telegram_data,
    media_metadata: supabaseRow.media_metadata,
    glide_data: supabaseRow.glide_data
  });

  return mappedData;
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  const schema = GlideTableSchema;
  const mediaJson = JSON.parse(glideData[schema.mediaJson.name] || '{}');
  
  return {
    id: glideData[schema.id.name],
    file_type: glideData[schema.fileType.name],
    public_url: glideData[schema.publicUrl.name],
    product_name: glideData[schema.productName.name],
    product_code: glideData[schema.productCode.name],
    quantity: glideData[schema.quantity.name],
    caption: glideData[schema.caption.name],
    vendor_uid: glideData[schema.vendorUid.name],
    purchase_date: glideData[schema.purchaseDate.name],
    notes: glideData[schema.notes.name],
    analyzed_content: JSON.parse(glideData[schema.analyzedContent.name] || '{}'),
    purchase_order_uid: glideData[schema.purchaseOrderUid.name],
    default_public_url: glideData[schema.defaultPublicUrl.name],
    telegram_media_row_id: rowID,
    telegram_data: mediaJson.telegram_data || {},
    media_metadata: mediaJson.media_metadata || {},
    glide_data: mediaJson.glide_data || {}
  };
}