import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramUpdate {
  message?: {
    message_id: number;
    from: any;
    chat: any;
    date: number;
    text?: string;
    caption?: string;
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    video?: {
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    animation?: {
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    media_group_id?: string;
    forward_from?: any;
    forward_from_chat?: any;
    forward_date?: number;
  };
}

async function getFileInfo(fileId: string, botToken: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  return data.ok ? data.result : null;
}

async function downloadTelegramFile(filePath: string, botToken: string) {
  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${filePath}`
  );
  return response;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
      throw new Error('Missing required environment variables');
    }

    // Verify webhook secret
    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    if (!update.message) {
      return new Response(
        JSON.stringify({ message: 'No message in update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Handle different types of media
    const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
    let mediaFile = null;
    let mediaType = '';

    for (const type of mediaTypes) {
      if (update.message[type]) {
        mediaFile = type === 'photo' 
          ? update.message[type]![update.message[type]!.length - 1] // Get the largest photo
          : update.message[type];
        mediaType = type;
        break;
      }
    }

    if (!mediaFile) {
      return new Response(
        JSON.stringify({ message: 'No media in message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get file info from Telegram
    const fileInfo = await getFileInfo(mediaFile.file_id, TELEGRAM_BOT_TOKEN);
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('Could not get file info from Telegram');
    }

    // Download file from Telegram
    const fileResponse = await downloadTelegramFile(fileInfo.file_path, TELEGRAM_BOT_TOKEN);
    const fileName = `${mediaFile.file_unique_id}.${fileInfo.file_path.split('.').pop()}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, fileResponse.body, {
        contentType: mediaFile.mime_type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Prepare telegram_data
    const telegramData = {
      message_id: update.message.message_id,
      from: update.message.from,
      chat: update.message.chat,
      date: update.message.date,
      caption: update.message.caption,
      media_group_id: update.message.media_group_id,
      forward_from: update.message.forward_from,
      forward_from_chat: update.message.forward_from_chat,
      forward_date: update.message.forward_date,
      file_size: mediaFile.file_size,
      mime_type: mediaFile.mime_type,
      width: mediaFile.width,
      height: mediaFile.height,
      duration: 'duration' in mediaFile ? mediaFile.duration : null,
      storage_path: fileName
    };

    // Insert into telegram_media table
    const { error: dbError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: mediaFile.file_id,
        file_unique_id: mediaFile.file_unique_id,
        file_type: mediaType,
        telegram_data: telegramData,
      });

    if (dbError) {
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ message: 'Successfully processed media' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})