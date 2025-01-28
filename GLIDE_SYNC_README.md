# Telegram Media Processing Flow Documentation

## 1. Message Reception & Initial Processing
### Webhook Entry Point
- URL: `/functions/v1/telegram-webhook`
- Validates incoming updates with webhook secret
- Uses webhook-handler.ts for message processing
- Generates unique correlation_id for tracking

### Initial Message Processing
- Creates record in messages table
- Analyzes caption using OpenAI if present
- Extracts product information
- Sets is_original_caption flag
- Updates message_media_data JSON structure

## 2. Media Group Handling
### Group Detection & Processing
- Identifies media group messages
- Tracks media_group_size
- Syncs analyzed content across group
- Updates all related messages

### Caption Management
- Identifies original caption holder
- Shares analyzed content across group
- Maintains caption relationships
- Updates message_media_data for all items

## 3. Queue Management
### Unified Processing Queue
```typescript
{
  queue_type: 'media' | 'media_group'
  message_media_data: {
    message: {
      url: string
      media_group_id?: string
      caption?: string
      message_id: number
      chat_id: number
      date: number
    }
    sender: {
      sender_info: Record<string, any>
      chat_info: Record<string, any>
    }
    analysis: {
      analyzed_content: Record<string, any>
      product_name?: string
      product_code?: string
      quantity?: number
      vendor_uid?: string
      purchase_date?: string
      notes?: string
    }
    meta: {
      created_at: string
      updated_at: string
      status: string
      error: string | null
      is_original_caption: boolean
      original_message_id: uuid | null
      processed_at: string | null
      last_retry_at: string | null
      retry_count: number
    }
  }
  status: 'pending' | 'processing' | 'completed' | 'failed'
  correlation_id: uuid
}
```

### Queue Processing Logic
1. Messages marked as 'processed' when:
   - Single media item: Immediately after creation
   - Media group: Once all items are present and synced
2. Items added to unified_processing_queue
3. Queue processor checks for pending items
4. Groups items by media_group_id if present
5. Processes items based on priority and creation time

## 4. Current Status & Next Steps

### Working Components
✅ Webhook reception and validation
✅ Message creation and analysis
✅ Media group detection and syncing
✅ Caption analysis and sharing
✅ Queue management system
✅ Processing status tracking

### Pending Updates
🔄 Storage upload system
🔄 telegram_media record creation
🔄 Glide synchronization

## 5. Key Functions & Triggers

### Edge Functions
- `telegram-webhook`: Entry point for updates
- `process-media-queue`: Processes pending queue items

### Database Functions
- `fn_parse_analyzed_content()`: Parses and distributes analyzed content
- `fn_process_media()`: Prepares media items for processing
- `handle_retry_logic()`: Manages retry attempts and cleanup

### Active Triggers
- `trg_parse_analyzed_content`: Messages table, BEFORE INSERT/UPDATE
- `trg_process_media`: telegram_media table, BEFORE INSERT/UPDATE

## 6. Data Flow Sequence
```
[Telegram Update] → [Webhook Handler]
         ↓
[Message Creation] → [Caption Analysis]
         ↓
[Media Group Check] → [Content Sync]
         ↓
[Queue Management] → [Processing Queue]
```

## 7. Error Handling
- Retry logic with configurable attempts
- Error tracking in message_media_data
- Status updates for failed processing
- Cleanup of old processed items

## 8. Monitoring
- Function logs in Supabase dashboard
- Status tracking in unified_processing_queue
- Error messages in processing_error column
- Correlation ID tracking throughout flow

## 9. Configuration
Required environment variables:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
OPENAI_API_KEY=
```

## 10. Next Development Phase
1. Update storage upload system
2. Implement new telegram_media record creation
3. Complete Glide synchronization
4. Add comprehensive testing
5. Implement monitoring system

For detailed API documentation and additional information, refer to the [API Documentation](./API.md).