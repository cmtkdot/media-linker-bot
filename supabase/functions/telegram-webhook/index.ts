import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

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

async function analyzeCaption(caption: string, supabaseUrl: string, supabaseKey: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    return null;
  }
}

async function createMessage(supabase: any, message: any, productInfo: any = null) {
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .insert({
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: getMessageType(message),
      message_data: message,
      caption: message.caption,
      media_group_id: message.media_group_id,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity
      })
    })
    .select()
    .single();

  if (messageError) throw messageError;
  return messageData;
}

function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}

async function processMediaFile(
  supabase: any,
  mediaFile: any,
  mediaType: string,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null
) {
  // Get file info from Telegram
  const fileInfo = await getFileInfo(mediaFile.file_id, botToken);
  if (!fileInfo || !fileInfo.file_path) {
    throw new Error('Could not get file info from Telegram');
  }

  // Generate unique filename
  const fileExt = fileInfo.file_path.split('.').pop();
  const uniqueFileName = `${mediaType}_${mediaFile.file_unique_id}_${Date.now()}.${fileExt}`;

  // Download and upload file
  const fileResponse = await downloadTelegramFile(fileInfo.file_path, botToken);
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
      message_id: messageRecord.id,
      public_url: `https://kzfamethztziwqiocbwz.supabase.co/storage/v1/object/public/media/${uniqueFileName}`,
      ...(productInfo && {
        product_name: productInfo.product_name,
        product_code: productInfo.product_code,
        quantity: productInfo.quantity
      })
    });

  if (dbError) {
    throw new Error(`Failed to insert into database: ${dbError.message}`);
  }
}

serve(async (req) => {
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

    // Verify webhook secret
    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    const message = update.message || update.channel_post;
    if (!message) {
      return new Response(
        JSON.stringify({ message: 'No message in update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Analyze caption with AI if present
    let productInfo = null;
    if (message.caption) {
      productInfo = await analyzeCaption(message.caption, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      console.log('AI-extracted product info:', productInfo);
    }

    // Create message record first
    const messageRecord = await createMessage(supabase, message, productInfo);
    console.log('Created message record:', messageRecord);

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
        JSON.stringify({ message: 'Message processed (no media)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Process media file
    await processMediaFile(
      supabase,
      mediaFile,
      mediaType,
      message,
      messageRecord,
      TELEGRAM_BOT_TOKEN,
      productInfo
    );

    return new Response(
      JSON.stringify({ message: 'Successfully processed message and media' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});