import { analyzeCaptionWithAI } from './caption-analyzer.ts';

export async function findExistingGroupAnalysis(
  supabase: any,
  mediaGroupId: string
): Promise<any> {
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('analyzed_content, product_name, product_code, quantity, vendor_uid, purchase_date, notes')
    .eq('media_group_id', mediaGroupId)
    .not('analyzed_content', 'is', null)
    .maybeSingle();

  return existingMessage;
}

export async function syncMediaGroupContent(
  supabase: any,
  mediaGroupId: string,
  analyzedContent: any,
  productInfo: any
): Promise<void> {
  console.log('Syncing media group content:', {
    mediaGroupId,
    analyzedContent,
    productInfo
  });

  const { error: updateError } = await supabase
    .from('messages')
    .update({
      analyzed_content: analyzedContent,
      product_name: productInfo?.product_name,
      product_code: productInfo?.product_code,
      quantity: productInfo?.quantity,
      vendor_uid: productInfo?.vendor_uid,
      purchase_date: productInfo?.purchase_date,
      notes: productInfo?.notes,
      status: 'pending'
    })
    .eq('media_group_id', mediaGroupId);

  if (updateError) {
    console.error('Error syncing media group content:', updateError);
    throw updateError;
  }
}

export async function determineMessageStatus(
  message: any,
  analyzedContent: any | null,
  mediaGroupId: string | null
): Promise<string> {
  // All messages start as pending since we handle analysis upfront
  return 'pending';
}

export async function processMessageContent(
  supabase: any,
  message: any,
  correlationId: string
): Promise<{
  analyzedContent: any | null;
  messageStatus: string;
  productInfo: any | null;
}> {
  const mediaGroupId = message.media_group_id;
  let analyzedContent = null;
  let productInfo = null;
  let caption = null;

  console.log('Processing message content:', {
    messageId: message.message_id,
    mediaGroupId,
    correlationId
  });

  // Step 1: Extract caption from telegram data
  if (message.telegram_data) {
    caption = message.telegram_data.caption || message.caption;
  }

  // Step 2: Analyze caption if present
  if (caption) {
    try {
      analyzedContent = await analyzeCaptionWithAI(caption);
      console.log('Caption analyzed:', {
        messageId: message.message_id,
        correlationId,
        analyzedContent
      });

      if (analyzedContent) {
        productInfo = {
          product_name: analyzedContent.product_name,
          product_code: analyzedContent.product_code,
          quantity: analyzedContent.quantity,
          vendor_uid: analyzedContent.vendor_uid,
          purchase_date: analyzedContent.purchase_date,
          notes: analyzedContent.notes
        };
      }
    } catch (error) {
      console.error('Error analyzing caption:', error);
    }
  }

  // Step 3: If part of a media group, sync analyzed content
  if (mediaGroupId) {
    if (analyzedContent) {
      // If we have analyzed content, sync it to the group
      await syncMediaGroupContent(supabase, mediaGroupId, analyzedContent, productInfo);
    } else {
      // If no analyzed content, check if group has existing analysis
      const existingAnalysis = await findExistingGroupAnalysis(supabase, mediaGroupId);
      if (existingAnalysis?.analyzed_content) {
        analyzedContent = existingAnalysis.analyzed_content;
        productInfo = {
          product_name: existingAnalysis.product_name,
          product_code: existingAnalysis.product_code,
          quantity: existingAnalysis.quantity,
          vendor_uid: existingAnalysis.vendor_uid,
          purchase_date: existingAnalysis.purchase_date,
          notes: existingAnalysis.notes
        };
      }
    }
  }

  const messageStatus = await determineMessageStatus(message, analyzedContent, mediaGroupId);

  return {
    analyzedContent,
    messageStatus,
    productInfo
  };
}