export const extractVideoMetadata = (message: any) => {
  if (!message.video) return null;
  
  return {
    duration: message.video.duration,
    width: message.video.width,
    height: message.video.height,
    thumb: message.video.thumb
  };
};

export const buildMediaMetadata = (message: any, mediaType: string, storagePath: string) => {
  const baseMetadata = {
    file_size: message.file_size,
    mime_type: message.mime_type,
    width: message.width,
    height: message.height,
    storage_path: storagePath,
    bucket_id: 'media'
  };

  if (mediaType === 'video') {
    const videoMeta = extractVideoMetadata(message);
    return {
      ...baseMetadata,
      ...videoMeta
    };
  }

  return baseMetadata;
};