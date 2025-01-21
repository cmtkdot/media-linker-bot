import { supabase } from './client';

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

export function generateSafeFileName(
  productName: string = 'untitled',
  productCode: string = 'no_code',
  mediaType: string,
  extension: string,
  mediaGroupId?: string
): string {
  const safeName = (productName || 'untitled')
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  const safeCode = (productCode || 'no_code')
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  const safeMediaType = (mediaType || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const safeExtension = (extension || 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const timestamp = Date.now();
  const groupSuffix = mediaGroupId ? `_group_${mediaGroupId.replace(/[^a-z0-9]/g, '')}` : '';
  
  return `${safeName}_${safeCode}${groupSuffix}_${safeMediaType}_${timestamp}.${safeExtension}`;
}