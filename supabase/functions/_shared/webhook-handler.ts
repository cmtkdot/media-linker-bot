import { processMessageBatch } from './message-processor.ts';
import { processMediaFiles } from './media-processor.ts';
import { delay } from './retry-utils.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { syncMediaGroupCaptions } from './caption-sync.ts';

export async function handleWebhookUpdate(update: any, supabase: any, botToken: string) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  try {
    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Step 1: If this is part of a media group, check for existing data
    let existingGroupData = null;
    if (message.media_group_id) {
      const { data: existingMedia } = await supabase
        .from('telegram_media')
        .select('caption, product_name, product_code, quantity, vendor_uid, purchase_date, notes, analyzed_content')
        .eq('telegram_data->>media_group_id', message.media_group_id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (existingMedia) {
        existingGroupData = existingMedia;
        console.log('Found existing media group data:', existingGroupData);
      }
    }

    // Step 2: Analyze caption if present or use existing group data
    let analyzedContent = null;
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    } else if (existingGroupData?.analyzed_content) {
      analyzedContent = existingGroupData.analyzed_content;
      message.caption = existingGroupData.caption;
      console.log('Using existing group caption and analysis');
    }

    // Step 3: Process message with analyzed content
    const messageData = {
      ...message,
      analyzed_content: analyzedContent,
      product_name: analyzedContent?.product_name || existingGroupData?.product_name,
      product_code: analyzedContent?.product_code || existingGroupData?.product_code,
      quantity: analyzedContent?.quantity || existingGroupData?.quantity,
      vendor_uid: analyzedContent?.vendor_uid || existingGroupData?.vendor_uid,
      purchase_date: analyzedContent?.purchase_date || existingGroupData?.purchase_date,
      notes: analyzedContent?.notes || existingGroupData?.notes
    };

    try {
      await processMessageBatch([messageData], supabase);
    } catch (error) {
      console.error('Error processing message batch:', {
        error: error.message,
        stack: error.stack,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw new Error(`Failed to process message batch: ${error.message}`);
    }

    await delay(1000);

    // Step 4: Get the created message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (messageError) {
      console.error('Error fetching message record:', {
        error: messageError,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw new Error(`Failed to fetch message record: ${messageError.message}`);
    }

    if (!messageRecord) {
      console.error('Message record not found after creation:', {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw new Error('Failed to create message record: Record not found after creation');
    }

    // Step 5: Process media files if present
    const hasMedia = message.photo || message.video || message.document || message.animation;
    if (hasMedia) {
      try {
        await processMediaFiles(messageData, messageRecord, supabase, botToken);
      } catch (error) {
        console.error('Error processing media files:', {
          error: error.message,
          stack: error.stack,
          message_id: messageRecord.id,
          media_type: message.photo ? 'photo' : 
                     message.video ? 'video' : 
                     message.document ? 'document' : 
                     message.animation ? 'animation' : 'unknown'
        });
        throw new Error(`Failed to process media files: ${error.message}`);
      }
    }

    // Step 6: If this message has a caption and is part of a media group,
    // update other media in the group
    if ((message.caption || analyzedContent) && message.media_group_id) {
      try {
        await syncMediaGroupCaptions(message.media_group_id, supabase);
        console.log('Successfully synced media group captions and data');
      } catch (error) {
        console.error('Error syncing media group captions:', error);
      }
    }

    // Step 7: Update message status and ensure all fields are synced
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        status: 'success',
        processed_at: new Date().toISOString(),
        analyzed_content: analyzedContent,
        product_name: messageData.product_name,
        product_code: messageData.product_code,
        quantity: messageData.quantity,
        vendor_uid: messageData.vendor_uid,
        purchase_date: messageData.purchase_date,
        notes: messageData.notes
      })
      .eq('id', messageRecord.id);

    if (updateError) {
      console.error('Error updating message status:', {
        error: updateError,
        message_id: messageRecord.id
      });
      throw new Error(`Failed to update message status: ${updateError.message}`);
    }

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      record_id: messageRecord.id,
      analyzed_content: !!analyzedContent
    });

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id
    };

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });
    throw error;
  }
}