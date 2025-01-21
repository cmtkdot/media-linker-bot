import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function getTelegramFilePath(fileId: string, botToken: string): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get file info: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.ok || !data.result.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  return data.result.file_path;
}

export async function downloadTelegramFile(filePath: string, botToken: string): Promise<ArrayBuffer> {
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

export async function getAndDownloadTelegramFile(fileId: string, botToken: string): Promise<{
  buffer: ArrayBuffer;
  filePath: string;
}> {
  console.log(`Getting file path for file ID: ${fileId}`);
  const filePath = await getTelegramFilePath(fileId, botToken);
  
  console.log(`Downloading file from path: ${filePath}`);
  const buffer = await downloadTelegramFile(filePath, botToken);
  
  return { buffer, filePath };
}

export function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}

export function generateSafeFileName(productName: string, productCode: string, mediaType: string, extension: string): string {
  // Clean and format the product name
  const safeProductName = productName
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, ''); // Remove any other special characters

  // Clean the product code
  const safeProductCode = productCode
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  // Clean the media type
  const safeMediaType = mediaType.toLowerCase();

  // Clean the extension
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Combine all parts with underscores
  const fileName = `${safeProductName}_${safeProductCode}_${safeMediaType}`;

  // Add the extension
  return `${fileName}.${safeExtension}`;
}

export async function analyzeCaption(caption: string, supabaseUrl: string, supabaseKey: string) {
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