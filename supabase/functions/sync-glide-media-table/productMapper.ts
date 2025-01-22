import type { TelegramMedia, GlideMutation } from '../_shared/types.ts';

// Define the schema inline since we can't import it in the Edge Function context
const GlideTableSchema = {
  id: { name: 'UkkMS', type: 'string' },
  file_id: { name: '9Bod8', type: 'string' },
  file_unique_id: { name: 'IYnip', type: 'string' },
  file_type: { name: 'hbjE4', type: 'string' },
  public_url: { name: 'd8Di5', type: 'string' },
  product_name: { name: 'xGGv3', type: 'string' },
  product_code: { name: 'xlfB9', type: 'string' },
  quantity: { name: 'TWRwx', type: 'number' },
  telegram_data: { name: 'Wm1he', type: 'string' },
  glide_data: { name: 'ZRV7Z', type: 'string' },
  media_metadata: { name: 'Eu9Zn', type: 'string' },
  processed: { name: 'oj7fP', type: 'boolean' },
  processing_error: { name: 'A4sZX', type: 'string' },
  last_synced_at: { name: 'PWhCr', type: 'string' },
  created_at: { name: 'Oa3L9', type: 'string' },
  updated_at: { name: '9xwrl', type: 'string' },
  message_id: { name: 'Uzkgt', type: 'string' },
  caption: { name: 'pRsjz', type: 'string' },
  vendor_uid: { name: 'uxDo1', type: 'string' },
  purchase_date: { name: 'AMWxJ', type: 'date' },
  notes: { name: 'BkUFO', type: 'string' },
  analyzed_content: { name: 'QhAgy', type: 'string' },
  purchase_order_uid: { name: '3y8Wt', type: 'string' },
  default_public_url: { name: 'rCJK2', type: 'string' },
  media_json: { name: 'NL5gM', type: 'string' }
} as const;

function validateSchema(schema: typeof GlideTableSchema) {
  const requiredFields = [
    'id',
    'file_id',
    'file_unique_id',
    'file_type',
    'telegram_data',
    'media_metadata',
    'glide_data',
    'media_json'
  ];

  for (const field of requiredFields) {
    if (!schema[field] || !schema[field].name) {
      throw new Error(`Missing required field in schema: ${field}`);
    }
  }
  return schema;
}

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): GlideMutation['columnValues'] {
  console.log('Mapping Supabase row:', supabaseRow);

  const schema = validateSchema(GlideTableSchema);
  console.log('Using validated schema:', schema);

  if (!supabaseRow.id || !supabaseRow.file_id || !supabaseRow.file_unique_id || !supabaseRow.file_type) {
    throw new Error('Missing required fields in Supabase row');
  }

  const mappedData: GlideMutation['columnValues'] = {};

  try {
    // Map required fields first
    mappedData[schema.id.name] = supabaseRow.id;
    mappedData[schema.file_id.name] = supabaseRow.file_id;
    mappedData[schema.file_unique_id.name] = supabaseRow.file_unique_id;
    mappedData[schema.file_type.name] = supabaseRow.file_type;

    // Map optional fields with null checks
    if (supabaseRow.public_url) {
      mappedData[schema.public_url.name] = supabaseRow.public_url;
    }
    if (supabaseRow.product_name) {
      mappedData[schema.product_name.name] = supabaseRow.product_name;
    }
    if (supabaseRow.product_code) {
      mappedData[schema.product_code.name] = supabaseRow.product_code;
    }
    if (supabaseRow.quantity !== undefined) {
      mappedData[schema.quantity.name] = supabaseRow.quantity;
    }

    // Map JSON fields with stringification
    mappedData[schema.telegram_data.name] = JSON.stringify(supabaseRow.telegram_data || {});
    mappedData[schema.glide_data.name] = JSON.stringify(supabaseRow.glide_data || {});
    mappedData[schema.media_metadata.name] = JSON.stringify(supabaseRow.media_metadata || {});

    // Map remaining optional fields
    if (supabaseRow.processed !== undefined) {
      mappedData[schema.processed.name] = supabaseRow.processed;
    }
    if (supabaseRow.processing_error) {
      mappedData[schema.processing_error.name] = supabaseRow.processing_error;
    }
    if (supabaseRow.last_synced_at) {
      mappedData[schema.last_synced_at.name] = supabaseRow.last_synced_at;
    }
    if (supabaseRow.created_at) {
      mappedData[schema.created_at.name] = supabaseRow.created_at;
    }
    if (supabaseRow.updated_at) {
      mappedData[schema.updated_at.name] = supabaseRow.updated_at;
    }
    if (supabaseRow.message_id) {
      mappedData[schema.message_id.name] = supabaseRow.message_id;
    }
    if (supabaseRow.caption) {
      mappedData[schema.caption.name] = supabaseRow.caption;
    }
    if (supabaseRow.vendor_uid) {
      mappedData[schema.vendor_uid.name] = supabaseRow.vendor_uid;
    }
    if (supabaseRow.purchase_date) {
      mappedData[schema.purchase_date.name] = supabaseRow.purchase_date;
    }
    if (supabaseRow.notes) {
      mappedData[schema.notes.name] = supabaseRow.notes;
    }
    if (supabaseRow.analyzed_content) {
      mappedData[schema.analyzed_content.name] = JSON.stringify(supabaseRow.analyzed_content || {});
    }
    if (supabaseRow.purchase_order_uid) {
      mappedData[schema.purchase_order_uid.name] = supabaseRow.purchase_order_uid;
    }
    if (supabaseRow.default_public_url) {
      mappedData[schema.default_public_url.name] = supabaseRow.default_public_url;
    }
    
    // Create media_json from the data
    mappedData[schema.media_json.name] = JSON.stringify({
      telegram_data: supabaseRow.telegram_data || {},
      media_metadata: supabaseRow.media_metadata || {},
      glide_data: supabaseRow.glide_data || {}
    });

    console.log('Successfully mapped data:', mappedData);
    return mappedData;
  } catch (error) {
    console.error('Error mapping data:', {
      error,
      schema: schema,
      supabaseRow: supabaseRow,
      mappedData: mappedData
    });
    throw error;
  }
}

export function mapGlideToSupabase(glideData: Record<string, unknown>, rowID?: string): Partial<TelegramMedia> {
  const schema = GlideTableSchema;

  const parseJsonSafely = (value: unknown) => {
    if (typeof value !== 'string') return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };
  
  return {
    id: String(glideData[schema.id.name] || ''),
    file_id: String(glideData[schema.file_id.name] || ''),
    file_unique_id: String(glideData[schema.file_unique_id.name] || ''),
    file_type: String(glideData[schema.file_type.name] || ''),
    public_url: glideData[schema.public_url.name] as string,
    product_name: glideData[schema.product_name.name] as string,
    product_code: glideData[schema.product_code.name] as string,
    quantity: Number(glideData[schema.quantity.name] || 0),
    telegram_data: parseJsonSafely(glideData[schema.telegram_data.name]),
    glide_data: parseJsonSafely(glideData[schema.glide_data.name]),
    media_metadata: parseJsonSafely(glideData[schema.media_metadata.name]),
    processed: Boolean(glideData[schema.processed.name]),
    processing_error: glideData[schema.processing_error.name] as string,
    last_synced_at: glideData[schema.last_synced_at.name] as string,
    created_at: glideData[schema.created_at.name] as string,
    updated_at: glideData[schema.updated_at.name] as string,
    message_id: glideData[schema.message_id.name] as string,
    caption: glideData[schema.caption.name] as string,
    vendor_uid: glideData[schema.vendor_uid.name] as string,
    purchase_date: glideData[schema.purchase_date.name] as string,
    notes: glideData[schema.notes.name] as string,
    analyzed_content: parseJsonSafely(glideData[schema.analyzed_content.name]),
    purchase_order_uid: glideData[schema.purchase_order_uid.name] as string,
    default_public_url: glideData[schema.default_public_url.name] as string,
    telegram_media_row_id: rowID
  };
}