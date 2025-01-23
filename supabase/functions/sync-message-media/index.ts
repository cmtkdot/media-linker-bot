import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";
import { getAndDownloadTelegramFile } from "../_shared/telegram-service.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all telegram_media records that need processing
    const { data: mediaRecords, error: fetchError } = await supabase
      .from('telegram_media')
      .select('*')
      .is('public_url', null);

    if (fetchError) throw fetchError;

    let processedCount = 0;
    let syncedMedia = 0;

    for (const record of mediaRecords || []) {
      try {
        processedCount++;

        // Download and process the file
        const { buffer, filePath } = await getAndDownloadTelegramFile(record.file_id, TELEGRAM_BOT_TOKEN);
        
        // Upload to storage
        const fileExt = filePath.split('.').pop() || '';
        const fileName = `${record.file_unique_id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, buffer, {
            contentType: record.file_type === 'photo' ? 'image/jpeg' : 'video/mp4',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = await supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        // If there's a caption, analyze it
        let analyzedContent = null;
        if (record.caption) {
          try {
            analyzedContent = await analyzeCaptionWithAI(record.caption);
          } catch (error) {
            console.error('Error analyzing caption:', error);
          }
        }

        // Update the record
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
            public_url: publicUrl,
            analyzed_content: analyzedContent || record.analyzed_content,
            product_name: analyzedContent?.product_name || record.product_name,
            product_code: analyzedContent?.product_code || record.product_code,
            quantity: analyzedContent?.quantity || record.quantity,
            vendor_uid: analyzedContent?.vendor_uid || record.vendor_uid,
            purchase_date: analyzedContent?.purchase_date || record.purchase_date,
            notes: analyzedContent?.notes || record.notes
          })
          .eq('id', record.id);

        if (updateError) throw updateError;

        syncedMedia++;
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        synced_media: syncedMedia
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-message-media function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});