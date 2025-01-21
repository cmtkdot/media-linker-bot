import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as glide from "https://esm.sh/@glideapps/tables@1.1.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Glide table
    const telegramMediaTable = glide.table({
      token: "dbff904d-7e53-499e-a237-41fc351a7c10",
      app: "5XJos60qGtkJzQUb5cJq",
      table: "native-table-crVqfFJXQde5cGcYmqWs",
      columns: {
        id: { type: "string", name: "UkkMS" },
        fileId: { type: "string", name: "9Bod8" },
        fileUniqueId: { type: "string", name: "IYnip" },
        fileType: { type: "string", name: "hbjE4" },
        publicUrl: { type: "uri", name: "d8Di5" },
        productName: { type: "string", name: "xGGv3" },
        productCode: { type: "string", name: "xlfB9" },
        quantity: { type: "number", name: "TWRwx" },
        telegramData: { type: "string", name: "Wm1he" },
        glideData: { type: "string", name: "ZRV7Z" },
        mediaMetadata: { type: "string", name: "Eu9Zn" },
        processed: { type: "boolean", name: "oj7fP" },
        processingError: { type: "string", name: "A4sZX" },
        lastSyncedAt: { type: "string", name: "PWhCr" },
        createdAt: { type: "string", name: "Oa3L9" },
        updatedAt: { type: "string", name: "9xwrl" },
        messageId: { type: "string", name: "Uzkgt" },
        caption: { type: "string", name: "pRsjz" },
        vendorUid: { type: "string", name: "uxDo1" },
        purchaseDate: { type: "date", name: "AMWxJ" },
        notes: { type: "string", name: "BkUFO" },
        analyzedContent: { type: "string", name: "QhAgy" },
        purchaseOrderUid: { type: "string", name: "3y8Wt" },
        defaultPublicUrl: { type: "uri", name: "rCJK2" }
      }
    });

    // Get all rows from Glide
    console.log('Fetching data from Glide...');
    const glideRows = await telegramMediaTable.readAll();
    console.log(`Fetched ${glideRows.length} rows from Glide`);

    // Get all telegram_media records from Supabase
    const { data: supabaseRows, error: fetchError } = await supabase
      .from('telegram_media')
      .select('*');

    if (fetchError) throw fetchError;

    let updated = 0;
    let added = 0;
    let errors = [];

    // Update Supabase with Glide data
    for (const glideRow of glideRows) {
      try {
        // Look for existing record by Glide ID
        const existingRecord = supabaseRows?.find(row => row.id === glideRow.id);

        if (existingRecord) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({
              product_name: glideRow.productName,
              product_code: glideRow.productCode,
              quantity: glideRow.quantity,
              vendor_uid: glideRow.vendorUid,
              purchase_date: glideRow.purchaseDate,
              notes: glideRow.notes,
              glide_data: JSON.parse(glideRow.glideData || '{}'),
              telegram_media_row_id: glideRow.id,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', existingRecord.id);

          if (updateError) throw updateError;
          updated++;
        } else {
          // Add new record from Glide
          const { error: insertError } = await supabase
            .from('telegram_media')
            .insert({
              id: glideRow.id, // Use Glide's ID
              file_id: glideRow.fileId,
              file_unique_id: glideRow.fileUniqueId,
              file_type: glideRow.fileType,
              public_url: glideRow.publicUrl,
              product_name: glideRow.productName,
              product_code: glideRow.productCode,
              quantity: glideRow.quantity,
              telegram_data: JSON.parse(glideRow.telegramData || '{}'),
              glide_data: JSON.parse(glideRow.glideData || '{}'),
              media_metadata: JSON.parse(glideRow.mediaMetadata || '{}'),
              processed: glideRow.processed,
              processing_error: glideRow.processingError,
              message_id: glideRow.messageId,
              caption: glideRow.caption,
              vendor_uid: glideRow.vendorUid,
              purchase_date: glideRow.purchaseDate,
              notes: glideRow.notes,
              analyzed_content: JSON.parse(glideRow.analyzedContent || '{}'),
              purchase_order_uid: glideRow.purchaseOrderUid,
              default_public_url: glideRow.defaultPublicUrl,
              telegram_media_row_id: glideRow.id
            });

          if (insertError) throw insertError;
          added++;
        }
      } catch (error) {
        console.error('Error processing Glide row:', error);
        errors.push(`Error processing Glide row ${glideRow.id}: ${error.message}`);
      }
    }

    // Update Glide with new Supabase data
    for (const supabaseRow of supabaseRows || []) {
      try {
        if (supabaseRow.telegram_media_row_id) {
          // Update existing Glide record
          await telegramMediaTable.update(supabaseRow.telegram_media_row_id, {
            fileId: supabaseRow.file_id,
            fileUniqueId: supabaseRow.file_unique_id,
            fileType: supabaseRow.file_type,
            publicUrl: supabaseRow.public_url,
            productName: supabaseRow.product_name,
            productCode: supabaseRow.product_code,
            quantity: supabaseRow.quantity,
            telegramData: JSON.stringify(supabaseRow.telegram_data),
            glideData: JSON.stringify(supabaseRow.glide_data),
            mediaMetadata: JSON.stringify(supabaseRow.media_metadata),
            processed: supabaseRow.processed,
            processingError: supabaseRow.processing_error,
            messageId: supabaseRow.message_id,
            caption: supabaseRow.caption,
            vendorUid: supabaseRow.vendor_uid,
            purchaseDate: supabaseRow.purchase_date,
            notes: supabaseRow.notes,
            analyzedContent: JSON.stringify(supabaseRow.analyzed_content),
            purchaseOrderUid: supabaseRow.purchase_order_uid,
            defaultPublicUrl: supabaseRow.default_public_url
          });
          updated++;
        } else {
          // Create new Glide record
          const glideId = await telegramMediaTable.add({
            fileId: supabaseRow.file_id,
            fileUniqueId: supabaseRow.file_unique_id,
            fileType: supabaseRow.file_type,
            publicUrl: supabaseRow.public_url,
            productName: supabaseRow.product_name,
            productCode: supabaseRow.product_code,
            quantity: supabaseRow.quantity,
            telegramData: JSON.stringify(supabaseRow.telegram_data),
            glideData: JSON.stringify(supabaseRow.glide_data),
            mediaMetadata: JSON.stringify(supabaseRow.media_metadata),
            processed: supabaseRow.processed,
            processingError: supabaseRow.processing_error,
            messageId: supabaseRow.message_id,
            caption: supabaseRow.caption,
            vendorUid: supabaseRow.vendor_uid,
            purchaseDate: supabaseRow.purchase_date,
            notes: supabaseRow.notes,
            analyzedContent: JSON.stringify(supabaseRow.analyzed_content),
            purchaseOrderUid: supabaseRow.purchase_order_uid,
            defaultPublicUrl: supabaseRow.default_public_url
          });

          // Update Supabase record with new Glide ID
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({ 
              telegram_media_row_id: glideId,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', supabaseRow.id);

          if (updateError) throw updateError;
          added++;
        }
      } catch (error) {
        console.error('Error syncing to Glide:', error);
        errors.push(`Error syncing row ${supabaseRow.id} to Glide: ${error.message}`);
      }
    }

    console.log('Sync completed:', { updated, added, errors });

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated, added, errors }
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync operation:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});