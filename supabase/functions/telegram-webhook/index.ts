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
  };
  channel_post?: {
    message_id: number;
    sender_chat: any;
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

async function syncMediaGroupCaption(
  supabase: any,
  mediaGroupId: string,
  caption: string | undefined,
  telegramData: any
) {
  if (!mediaGroupId || !caption) return;

  // Extract product information from caption
  const productInfo = {
    product_name: undefined as string | undefined,
    product_code: undefined as string | undefined,
    quantity: undefined as number | undefined,
  };

  if (caption) {
    const parts = caption.split('#');
    if (parts.length > 1) {
      productInfo.product_name = parts[0].trim();
      const codeParts = parts[1].split('x').map(part => part.trim());
      if (codeParts.length > 0) {
        productInfo.product_code = codeParts[0];
        if (codeParts.length > 1) {
          const quantity = parseFloat(codeParts[1]);
          if (!isNaN(quantity)) {
            productInfo.quantity = quantity;
          }
        }
      }
    }
  }

  // Update all media in the same group
  const { error } = await supabase
    .from('telegram_media')
    .update({
      product_name: productInfo.product_name,
      product_code: productInfo.product_code,
      quantity: productInfo.quantity,
      telegram_data: {
        ...telegramData,
        caption,
      },
    })
    .eq('telegram_data->>media_group_id', mediaGroupId);

  if (error) {
    console.error('Error syncing media group caption:', error);
  }
}

serve(async (req) => {
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

    // Handle both regular messages and channel posts
    const message = update.message || update.channel_post;
    if (!message) {
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
      if (message[type]) {
        mediaFile = type === 'photo' 
          ? message[type]![message[type]!.length - 1] // Get the largest photo
          : message[type];
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

    // Generate unique filename based on file type and unique ID
    const fileExt = fileInfo.file_path.split('.').pop();
    const uniqueFileName = `${mediaType}_${mediaFile.file_unique_id}_${Date.now()}.${fileExt}`;

    // Download file from Telegram
    const fileResponse = await downloadTelegramFile(fileInfo.file_path, TELEGRAM_BOT_TOKEN);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(uniqueFileName, fileResponse.body, {
        contentType: mediaFile.mime_type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Prepare telegram_data
    const telegramData = {
      message_id: message.message_id,
      sender_chat: message.sender_chat,
      chat: message.chat,
      date: message.date,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_size: mediaFile.file_size,
      mime_type: mediaFile.mime_type,
      width: mediaFile.width,
      height: mediaFile.height,
      duration: 'duration' in mediaFile ? mediaFile.duration : null,
      storage_path: uniqueFileName
    };

    // Insert into telegram_media table
    const { error: dbError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: mediaFile.file_id,
        file_unique_id: mediaFile.file_unique_id,
        file_type: mediaType,
        telegram_data: telegramData,
        public_url: `https://kzfamethztziwqiocbwz.supabase.co/storage/v1/object/public/media/${uniqueFileName}`,
      });

    if (dbError) {
      throw new Error(`Failed to insert into database: ${dbError.message}`);
    }

    // Sync caption for media group if applicable
    if (message.media_group_id && message.caption) {
      await syncMediaGroupCaption(
        supabase,
        message.media_group_id,
        message.caption,
        telegramData
      );
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