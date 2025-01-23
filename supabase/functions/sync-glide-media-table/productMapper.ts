import { GlideTableSchema, TelegramMedia } from './types.ts';

export function mapSupabaseToGlide(supabaseRow: TelegramMedia): Record<string, any> {
  console.log('Mapping Supabase data to Glide:', {
    id: supabaseRow.id,
    product_name: supabaseRow.product_name,
    vendor_uid: supabaseRow.vendor_uid,
    has_analyzed_content: !!supabaseRow.analyzed_content
  });

  const mappedData: Record<string, any> = {};

  // Map each field according to the schema
  Object.entries(GlideTableSchema).forEach(([key, field]) => {
    if (key in supabaseRow) {
      const value = supabaseRow[key as keyof TelegramMedia];
      
      // Special handling for analyzed_content to ensure product info is mapped
      if (key === 'analyzed_content' && value) {
        const analyzedContent = value as Record<string, any>;
        mappedData[GlideTableSchema.product_name.name] = analyzedContent.product_name || supabaseRow.product_name;
        mappedData[GlideTableSchema.vendor_uid.name] = analyzedContent.vendor_uid || supabaseRow.vendor_uid;
        mappedData[GlideTableSchema.purchase_date.name] = analyzedContent.purchase_date || supabaseRow.purchase_date;
        mappedData[GlideTableSchema.product_code.name] = analyzedContent.product_code || supabaseRow.product_code;
        mappedData[GlideTableSchema.quantity.name] = analyzedContent.quantity || supabaseRow.quantity;
        mappedData[GlideTableSchema.notes.name] = analyzedContent.notes || supabaseRow.notes;
      }
      
      // Handle JSON fields by stringifying them
      if (field.type === 'json' && value !== null) {
        mappedData[field.name] = JSON.stringify(value);
      } else {
        mappedData[field.name] = value;
      }
    }
  });

  // Ensure URLs are properly mapped
  if (supabaseRow.message_url) {
    mappedData[GlideTableSchema.message_url.name] = supabaseRow.message_url;
  }
  if (supabaseRow.chat_url) {
    mappedData[GlideTableSchema.chat_url.name] = supabaseRow.chat_url;
  }
  if (supabaseRow.glide_app_url) {
    mappedData[GlideTableSchema.glide_app_url.name] = supabaseRow.glide_app_url;
  }

  // Set purchase_order_uid if product_code exists
  if (supabaseRow.product_code) {
    mappedData[GlideTableSchema.purchase_order_uid.name] = `PO#${supabaseRow.product_code}`;
  }

  console.log('Mapped Glide data:', mappedData);
  return mappedData;
}

export function mapGlideToSupabase(glideData: Record<string, any>, rowID?: string): Partial<TelegramMedia> {
  console.log('Mapping Glide data to Supabase:', {
    rowID,
    has_data: !!glideData
  });

  const reverseMapping: Partial<TelegramMedia> = {};
  
  // Create a reverse mapping of Glide column names to Supabase field names
  const reverseSchema = Object.entries(GlideTableSchema).reduce((acc, [key, field]) => {
    acc[field.name] = { key, type: field.type };
    return acc;
  }, {} as Record<string, { key: string; type: string }>);

  // Map Glide data to Supabase format
  Object.entries(glideData).forEach(([glideName, value]) => {
    const mapping = reverseSchema[glideName];
    if (mapping) {
      const { key, type } = mapping;
      
      // Handle JSON fields by parsing them
      if (type === 'json' && typeof value === 'string') {
        try {
          reverseMapping[key as keyof TelegramMedia] = JSON.parse(value);
        } catch (e) {
          console.error(`Error parsing JSON for field ${key}:`, e);
          reverseMapping[key as keyof TelegramMedia] = null;
        }
      } else {
        reverseMapping[key as keyof TelegramMedia] = value;
      }
    }
  });

  // Add the Glide row ID if provided
  if (rowID) {
    reverseMapping.telegram_media_row_id = rowID;
  }

  // Extract product info from analyzed_content if available
  if (reverseMapping.analyzed_content) {
    const analyzedContent = reverseMapping.analyzed_content as Record<string, any>;
    reverseMapping.product_name = analyzedContent.product_name || reverseMapping.product_name;
    reverseMapping.vendor_uid = analyzedContent.vendor_uid || reverseMapping.vendor_uid;
    reverseMapping.purchase_date = analyzedContent.purchase_date || reverseMapping.purchase_date;
    reverseMapping.product_code = analyzedContent.product_code || reverseMapping.product_code;
    reverseMapping.quantity = analyzedContent.quantity || reverseMapping.quantity;
    reverseMapping.notes = analyzedContent.notes || reverseMapping.notes;
  }

  // Set purchase_order_uid if product_code exists
  if (reverseMapping.product_code) {
    reverseMapping.purchase_order_uid = `PO#${reverseMapping.product_code}`;
  }

  console.log('Mapped Supabase data:', reverseMapping);
  return reverseMapping;
}