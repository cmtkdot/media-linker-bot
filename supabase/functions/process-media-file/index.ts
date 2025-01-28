import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MediaProcessingError } from "../_shared/error-handler.ts";
import { processMediaMessage } from "../_shared/media-processor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { 
      fileId, 
      fileUniqueId, 
      fileType, 
      messageId, 
      botToken, 
      correlationId,
      mediaFile 
    } = await req.json();

    if (!fileId || !fileUniqueId || !fileType || !messageId || !botToken) {
      throw new MediaProcessingError(
        'Missing required parameters',
        'INVALID_PARAMETERS',
        { fileId, fileType, messageId },
        false
      );
    }

    const { publicUrl, storagePath } = await processMediaMessage(
      supabase,
      messageId,
      fileId,
      fileUniqueId,
      fileType,
      botToken,
      mediaFile,
      correlationId
    );

    return new Response(
      JSON.stringify({ 
        message: 'Media processing completed',
        publicUrl,
        storagePath
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media:', error);
    
    const errorResponse = {
      error: error instanceof MediaProcessingError 
        ? error.message 
        : 'An unexpected error occurred',
      code: error instanceof MediaProcessingError ? error.code : 'UNKNOWN_ERROR',
      details: error instanceof MediaProcessingError ? error.details : undefined
    };

    return new Response(
      JSON.stringify(errorResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});