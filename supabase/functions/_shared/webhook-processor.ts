import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { handleMessageProcessing } from './message-manager.ts';
import { processMedia } from './media-handler.ts';
import { syncMediaGroupInfo } from './media-group-sync.ts';
import { TelegramMessage } from './webhook-types.ts';

export async function processWebhookUpdate(
  message: TelegramMessage,
  supabase: any,
  botToken: string
) {
  console.log('[Processing Start]', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_group_id: message.media_group_id,
    timestamp: new Date().toISOString()
  });

  let messageRecord = null;
  let productInfo = null;
  let mediaResult = null;

  try {
    // Step 1: Analyze caption if present
    if (message.caption) {
      console.log('[Caption Analysis] Starting...', {
        message_id: message.message_id,
        caption: message.caption
      });
      
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('[Caption Analysis] Complete', { product_info: productInfo });
      } catch (error) {
        console.error('[Caption Analysis Error]', error);
      }
    }

    // Step 2: Process message
    console.log('[Message Processing] Starting...', {
      message_id: message.message_id,
      media_group_id: message.media_group_id
    });

    const messageResult = await handleMessageProcessing(supabase, message, null, productInfo);
    if (!messageResult.success) {
      throw new Error(messageResult.error);
    }

    messageRecord = messageResult.messageRecord;

    // Step 3: If this is part of a media group, sync the group info
    if (message.media_group_id && messageRecord) {
      console.log('[Media Group Sync] Starting...', {
        media_group_id: message.media_group_id
      });
      
      await syncMediaGroupInfo(supabase, message, messageRecord);
    }
    
    // Step 4: Process media after group sync
    if (messageRecord) {
      console.log('[Media Processing] Starting...', {
        message_record_id: messageRecord.id,
        message_id: message.message_id
      });

      mediaResult = await processMedia(
        supabase,
        message,
        messageRecord,
        botToken,
        productInfo,
        0
      );

      // Step 5: Update message status
      const { error: messageUpdateError } = await supabase
        .from('messages')
        .update({
          status: 'success',
          processed_at: new Date().toISOString(),
          ...(productInfo && {
            product_name: productInfo.product_name,
            product_code: productInfo.product_code,
            quantity: productInfo.quantity,
            vendor_uid: productInfo.vendor_uid,
            purchase_date: productInfo.purchase_date,
            notes: productInfo.notes,
            analyzed_content: productInfo
          })
        })
        .eq('id', messageRecord.id);

      if (messageUpdateError) {
        console.error('[Message Status Update Error]', messageUpdateError);
      }
    }

    return { 
      success: true,
      messageId: messageRecord?.id,
      mediaResult,
      productInfo
    };

  } catch (error) {
    console.error('[Processing Error]', {
      error: error.message,
      message_id: message.message_id,
      chat_id: message.chat.id
    });
    throw error;
  }
}