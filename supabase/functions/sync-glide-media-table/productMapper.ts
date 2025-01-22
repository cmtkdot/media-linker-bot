import type { GlideTableSchema, TelegramMedia } from '../_shared/types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  const schema = GlideTableSchema;
  const mappedData: Record<string, any> = {};

  // Map fields according to schema
  mappedData[schema.id.name] = supabaseRow.id;
  mappedData[schema.file_id.name] = supabaseRow.file_id;
  mappedData[schema.file_unique_id.name] = supabaseRow.file_unique_id;
  mappedData[schema.file_type.name] = supabaseRow.file_type;
  mappedData[schema.public_url.name] = supabaseRow.public_url;
  mappedData[schema.product_name.name] = supabaseRow.product_name;
  mappedData[schema.product_code.name] = supabaseRow.product_code;
  mappedData[schema.quantity.name] = supabaseRow.quantity;
  mappedData[schema.telegram_data.name] = JSON.stringify(supabaseRow.telegram_data);
  mappedData[schema.glide_data.name] = JSON.stringify(supabaseRow.glide_data);
  mappedData[schema.media_metadata.name] = JSON.stringify(supabaseRow.media_metadata);
  mappedData[schema.processed.name] = supabaseRow.processed;
  mappedData[schema.processing_error.name] = supabaseRow.processing_error;
  mappedData[schema.last_synced_at.name] = supabaseRow.last_synced_at;
  mappedData[schema.created_at.name] = supabaseRow.created_at;
  mappedData[schema.updated_at.name] = supabaseRow.updated_at;
  mappedData[schema.message_id.name] = supabaseRow.message_id;
  mappedData[schema.caption.name] = supabaseRow.caption;
  mappedData[schema.vendor_uid.name] = supabaseRow.vendor_uid;
  mappedData[schema.purchase_date.name] = supabaseRow.purchase_date;
  mappedData[schema.notes.name] = supabaseRow.notes;
  mappedData[schema.analyzed_content.name] = JSON.stringify(supabaseRow.analyzed_content);
  mappedData[schema.purchase_order_uid.name] = supabaseRow.purchase_order_uid;
  mappedData[schema.default_public_url.name] = supabaseRow.default_public_url;
  
  // Create media_json from the data
  mappedData[schema.media_json.name] = JSON.stringify({
    telegram_data: supabaseRow.telegram_data,
    media_metadata: supabaseRow.media_metadata,
    glide_data: supabaseRow.glide_data
  });

  return mappedData;
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  const schema = GlideTableSchema;
  const mediaJson = JSON.parse(glideData[schema.media_json.name] || '{}');
  
  return {
    id: glideData[schema.id.name],
    file_id: glideData[schema.file_id.name],
    file_unique_id: glideData[schema.file_unique_id.name],
    file_type: glideData[schema.file_type.name],
    public_url: glideData[schema.public_url.name],
    product_name: glideData[schema.product_name.name],
    product_code: glideData[schema.product_code.name],
    quantity: glideData[schema.quantity.name],
    telegram_data: JSON.parse(glideData[schema.telegram_data.name] || '{}'),
    glide_data: JSON.parse(glideData[schema.glide_data.name] || '{}'),
    media_metadata: JSON.parse(glideData[schema.media_metadata.name] || '{}'),
    processed: glideData[schema.processed.name],
    processing_error: glideData[schema.processing_error.name],
    last_synced_at: glideData[schema.last_synced_at.name],
    created_at: glideData[schema.created_at.name],
    updated_at: glideData[schema.updated_at.name],
    message_id: glideData[schema.message_id.name],
    caption: glideData[schema.caption.name],
    vendor_uid: glideData[schema.vendor_uid.name],
    purchase_date: glideData[schema.purchase_date.name],
    notes: glideData[schema.notes.name],
    analyzed_content: JSON.parse(glideData[schema.analyzed_content.name] || '{}'),
    purchase_order_uid: glideData[schema.purchase_order_uid.name],
    default_public_url: glideData[schema.default_public_url.name],
    telegram_media_row_id: rowID
  };
}
