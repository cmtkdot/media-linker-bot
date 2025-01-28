export async function downloadTelegramFile(fileId: string, botToken: string) {
  try {
    console.log(`Downloading file ${fileId} from Telegram`);
    
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new Error('Failed to get file info from Telegram');
    }

    const fileResponse = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
    );
    const buffer = await fileResponse.arrayBuffer();

    return { buffer };
  } catch (error) {
    console.error('Error downloading file from Telegram:', error);
    throw error;
  }
}