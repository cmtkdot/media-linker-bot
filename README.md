# Telegram Media Collection & Product Management System

A web application that automatically collects, processes, and manages media from Telegram channels while linking them to product data in Glide.

## System Architecture

### Message Processing Flow

1. **Webhook Reception**
   - Edge Function: `telegram-webhook/index.ts`
   - Shared Functions:
     - `webhook-handler.ts`: Primary message processor
     - `database-retry.ts`: Handles database operation retries
   - Flow:
     1. Validates secret token from request headers
     2. Extracts message data and generates message URL
     3. Initial logging via `console.log`
     4. Uses `withDatabaseRetry` for reliable database operations

2. **Caption Analysis**
   - Edge Function: `analyze-caption/index.ts`
   - Shared Functions:
     - `caption-analyzer.ts`: OpenAI integration
   - Flow:
     1. Receives caption text from webhook
     2. Sends to OpenAI for analysis using `gpt-4o-mini` model
     3. Extracts product information:
        - Product name (before #)
        - Product code (between # and x)
        - Quantity (after x)
        - Vendor UID (letters before numbers in code)
        - Purchase date (6 digits from code)
     4. Returns structured JSON data

3. **Message Processing**
   - Tables: `messages`
   - Shared Functions:
     - `message-processor.ts`: Message handling logic
     - `database-service.ts`: Database operations
   - Flow:
     1. Creates/updates message record with:
        - Basic message data (ID, chat, type)
        - Sender information
        - Media group handling
        - Analyzed content from OpenAI
     2. Triggers media processing if media present

4. **Media Processing**
   - Tables: `telegram_media`
   - Shared Functions:
     - `media-processor.ts`: Core media handling
     - `media-validators.ts`: File validation
     - `media-database.ts`: Media record management
   - Flow:
     1. Downloads files from Telegram
     2. Validates MIME types and file integrity
     3. Uploads to Supabase storage
     4. Extracts video thumbnails from Telegram message data
     5. Creates/updates telegram_media records
     6. Handles media group relationships

5. **Glide Synchronization**
   - Edge Functions:
     - `sync-glide-media-table/index.ts`
     - `sync-missing-rows-to-glide/index.ts`
   - Shared Functions:
     - `sync-logger.ts`: Sync operation logging
     - `database-retry.ts`: Retry logic
   - Flow:
     1. Changes trigger entries in `glide_sync_queue`
     2. Periodic processing (every 5 minutes)
     3. Batch processing with retry logic
     4. Bidirectional updates between systems

### Database Structure

1. **messages**
   - Stores raw message data and parsed information
   - Key fields:
     - message_id: Telegram message identifier
     - chat_id: Source chat identifier
     - media_group_id: Groups related media
     - analyzed_content: Parsed product data
     - message_url: Direct Telegram link

2. **telegram_media**
   - Contains media file references and metadata
   - Key fields:
     - file_id: Telegram file identifier
     - public_url: Supabase storage URL
     - thumbnail_url: Video preview URL from Telegram
     - telegram_media_row_id: Glide reference

3. **glide_sync_queue**
   - Manages pending sync operations
   - Key fields:
     - operation: Type of sync (INSERT/UPDATE/DELETE)
     - record_id: Reference to telegram_media
     - processed_at: Completion timestamp

4. **failed_webhook_updates**
   - Tracks failed processing attempts
   - Key fields:
     - error_message: Failure details
     - retry_count: Number of attempts
     - message_data: Original payload

### Key Components

1. **Webhook Handler** (`telegram-webhook/index.ts`)
   - Primary entry point for Telegram updates
   - Coordinates with shared functions
   - Implements retry logic

2. **Media Processor** (`_shared/media-processor.ts`)
   - Handles file downloads and uploads
   - Extracts thumbnails from Telegram data
   - Updates database records

3. **Caption Analyzer** (`_shared/caption-analyzer.ts`)
   - Integrates with OpenAI
   - Extracts product information
   - Maintains consistent data format

4. **Error Handler** (`_shared/error-handler.ts`)
   - Centralizes error logging
   - Implements retry strategies
   - Maintains error records

5. **Database Service** (`_shared/database-service.ts`)
   - Provides database operation helpers
   - Implements transaction logic
   - Handles connection management

## Environment Setup

Required environment variables:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GLIDE_API_TOKEN=
```

## Project Structure

```
/src
  /components        # React components
    /ui             # shadcn/ui components
  /hooks            # Custom React hooks
  /lib             # Utility functions
  /types           # TypeScript types

/supabase
  /functions        # Edge Functions
    /_shared       # Shared utilities
    /telegram-webhook
    /sync-glide-media-table
```

## Error Handling

1. **Retry Mechanism**
   - Implemented in `database-retry.ts`
   - Exponential backoff strategy
   - Maximum retry attempts: 3

2. **Error Logging**
   - Table: `failed_webhook_updates`
   - Includes stack traces and context
   - Tracks retry attempts

3. **Performance Monitoring**
   - Table: `sync_performance_metrics`
   - Tracks operation timing
   - Records success/failure rates

4. **Health Checks**
   - Table: `sync_health_checks`
   - Monitors system components
   - Tracks sync status

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is private and confidential.