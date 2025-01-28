export interface QueueItem {
  id: string;
  message_media_data: {
    message: {
      media_group_id?: string;
      message_id: number;
    };
    media: {
      file_id: string;
      file_unique_id: string;
      file_type: string;
    };
    meta: {
      is_original_caption: boolean;
      original_message_id?: string;
    };
    analysis: {
      analyzed_content: any;
    };
  };
}

export interface ProcessingResult {
  success: boolean;
  error?: string;
  mediaId?: string;
}