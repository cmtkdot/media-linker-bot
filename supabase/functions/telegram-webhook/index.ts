import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";
import { processMediaFiles } from "../_shared/media-processor.ts";
import { extractVideoMetadata } from "../_shared/metadata-extractor.ts";
import { handleProcessingError } from "../_shared/error-handler.ts";
import { downloadAndStoreThumbnail } from "../_shared/thumbnail-handler.ts";
import { handleMessageProcessing } from "../_shared/message-manager.ts";

serve(async (req) => {
  console.log('Received webhook request:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Validate webhook secret
    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update = await req.json();
    const message = update.message || update.channel_post;

    if (!message) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No message to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing Telegram update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      has_caption: !!message.caption,
      media_group_id: message.media_group_id
    });

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat_id)
      .maybeSingle();

    // Generate message URL early
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Early caption analysis and metadata extraction
    let analyzedContent = null;
    let thumbnailUrl = null;
    let mediaMetadata = null;

    // Handle caption analysis
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Handle video metadata and thumbnail
    if (message.video) {
      mediaMetadata = extractVideoMetadata(message);
      if (message.video.thumb) {
        try {
          thumbnailUrl = await downloadAndStoreThumbnail(
            message.video.thumb,
            TELEGRAM_BOT_TOKEN,
            supabase
          );
        } catch (error) {
          console.error('Error processing thumbnail:', error);
        }
      }
    }

    // If message exists, check for missing telegram_media records
    if (existingMessage) {
      console.log('Found existing message, checking for missing media records');
      
      const hasMedia = message.photo || message.video || message.document || message.animation;
      if (hasMedia) {
        // Check for existing media records
        const { data: existingMedia } = await supabase
          .from('telegram_media')
          .select('*')
          .eq('message_id', existingMessage.id);

        if (!existingMedia || existingMedia.length === 0) {
          console.log('No telegram_media records found for existing message, processing media');
          try {
            await processMediaFiles(
              message,
              existingMessage,
              supabase,
              TELEGRAM_BOT_TOKEN,
              {
                ...mediaMetadata,
                thumbnail_url: thumbnailUrl,
                message_url: messageUrl,
                analyzed_content: analyzedContent
              }
            );
          } catch (error) {
            console.error('Error processing missing media:', error);
            await handleProcessingError(
              supabase,
              error,
              existingMessage,
              0,
              true
            );
          }
        } else {
          console.log('Existing media records found:', existingMedia.length);
        }
      }

      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: 'Existing message checked for missing media',
          messageId: existingMessage.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process new message using shared handler
    const { messageRecord, success, error } = await handleMessageProcessing(
      supabase,
      message,
      null,
      {
        ...analyzedContent,
        thumbnail_url: thumbnailUrl,
        message_url: messageUrl
      }
    );

    if (!success) {
      throw new Error(error || 'Failed to process message');
    }

    // Process media if present
    if (message.photo || message.video || message.document || message.animation) {
      try {
        await processMediaFiles(
          message,
          messageRecord,
          supabase,
          TELEGRAM_BOT_TOKEN,
          {
            ...mediaMetadata,
            thumbnail_url: thumbnailUrl,
            message_url: messageUrl,
            analyzed_content: analyzedContent
          }
        );
      } catch (error) {
        await handleProcessingError(
          supabase,
          error,
          messageRecord,
          0,
          true
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: 'Update processed successfully',
        messageId: messageRecord?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.status || 500
      }
    );
  }
});