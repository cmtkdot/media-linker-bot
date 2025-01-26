import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MessageMediaData {
  message: {
    url: string;
    media_group_id?: string;
    caption?: string;
    message_id: number;
    chat_id: number;
    date: number;
  };
  sender: {
    sender_info: Record<string, any>;
    chat_info: Record<string, any>;
  };
  analysis: {
    analyzed_content: Record<string, any>;
  };
  meta: {
    created_at: string;
    updated_at: string;
    status: string;
    error: string | null;
  };
  media: {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    public_url: string | null;
  };
  telegram_data: Record<string, any>;
}

export async function createTelegramMediaRecord(
  supabase: any,
  messageMediaData: MessageMediaData,
  correlationId: string
) {
  console.log('Creating telegram media record:', {
    file_id: messageMediaData.media.file_id,
    correlation_id: correlationId
  });

  try {
    // Check for existing record first
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, file_id')
      .eq('file_unique_id', messageMediaData.media.file_unique_id)
      .maybeSingle();

    if (existingMedia) {
      console.log('Media already exists:', {
        id: existingMedia.id,
        file_id: existingMedia.file_id
      });
      return existingMedia;
    }

    // Extract analyzed content
    const analyzedContent = messageMediaData.analysis.analyzed_content || {};

    // Create new telegram_media record
    const { data: mediaRecord, error } = await supabase
      .from('telegram_media')
      .insert({
        file_id: messageMediaData.media.file_id,
        file_unique_id: messageMediaData.media.file_unique_id,
        file_type: messageMediaData.media.file_type,
        public_url: messageMediaData.media.public_url,
        message_url: messageMediaData.message.url,
        caption: messageMediaData.message.caption,
        message_media_data: messageMediaData,
        analyzed_content: analyzedContent,
        telegram_data: messageMediaData.telegram_data,
        product_name: analyzedContent.product_name,
        product_code: analyzedContent.product_code,
        quantity: analyzedContent.quantity,
        vendor_uid: analyzedContent.vendor_uid,
        purchase_date: analyzedContent.purchase_date,
        notes: analyzedContent.notes,
        processed: false,
        sender_info: messageMediaData.sender.sender_info
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating telegram media record:', {
        error,
        correlation_id: correlationId
      });
      throw error;
    }

    console.log('Successfully created telegram media record:', {
      id: mediaRecord.id,
      file_id: mediaRecord.file_id,
      correlation_id: correlationId
    });

    return mediaRecord;
  } catch (error) {
    console.error('Error in createTelegramMediaRecord:', error);
    throw error;
  }
}