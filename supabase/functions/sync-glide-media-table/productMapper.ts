import { GlideTableSchema } from './types.ts';

export function mapSupabaseToGlide(supabaseRow: any): Record<string, any> {
  const schema = GlideTableSchema;
  const mappedData: Record<string, any> = {};

  // Map fields according to schema
  mappedData[schema.id.name] = supabaseRow.id;
  mappedData[schema.fileType.name] = supabaseRow.file_type;
  mappedData[schema.publicUrl.name] = supabaseRow.public_url;
  mappedData[schema.productName.name] = supabaseRow.product_name;
  mappedData[schema.productCode.name] = supabaseRow.product_code;
  mappedData[schema.quantity.name] = supabaseRow.quantity;
  mappedData[schema.lastSyncedAt.name] = supabaseRow.last_synced_at;
  mappedData[schema.caption.name] = supabaseRow.caption;
  mappedData[schema.vendorUid.name] = supabaseRow.vendor_uid;
  mappedData[schema.purchaseDate.name] = supabaseRow.purchase_date;
  mappedData[schema.notes.name] = supabaseRow.notes;
  mappedData[schema.analyzedContent.name] = JSON.stringify(supabaseRow.analyzed_content);
  mappedData[schema.purchaseOrderUid.name] = supabaseRow.purchase_order_uid;
  mappedData[schema.defaultPublicUrl.name] = supabaseRow.default_public_url;

  return mappedData;
}

export function mapGlideToSupabase(glideData: any): Record<string, any> {
  return {
    id: glideData[GlideTableSchema.id.name],
    file_type: glideData[GlideTableSchema.fileType.name],
    public_url: glideData[GlideTableSchema.publicUrl.name],
    product_name: glideData[GlideTableSchema.productName.name],
    product_code: glideData[GlideTableSchema.productCode.name],
    quantity: glideData[GlideTableSchema.quantity.name],
    last_synced_at: glideData[GlideTableSchema.lastSyncedAt.name],
    caption: glideData[GlideTableSchema.caption.name],
    vendor_uid: glideData[GlideTableSchema.vendorUid.name],
    purchase_date: glideData[GlideTableSchema.purchaseDate.name],
    notes: glideData[GlideTableSchema.notes.name],
    analyzed_content: JSON.parse(glideData[GlideTableSchema.analyzedContent.name] || '{}'),
    purchase_order_uid: glideData[GlideTableSchema.purchaseOrderUid.name],
    default_public_url: glideData[GlideTableSchema.defaultPublicUrl.name]
  };
}