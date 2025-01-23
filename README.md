# Telegram Media Collection & Product Management System

A web application that automatically collects, processes, and manages media from Telegram channels while linking them to product data in Glide.

## System Architecture

### Core Processing Flow

1. **Webhook Reception** (`telegram-webhook/index.ts`)
   - Validates incoming Telegram updates
   - Uses: `webhook-handler.ts`, `cors.ts`
   - Flow:
     1. Validates webhook secret
     2. Extracts message data
     3. Initiates message processing

2. **Message Processing** (`_shared/message-processor.ts`, `_shared/message-manager.ts`)
   - Handles incoming messages
   - Uses: `database-service.ts`, `caption-analyzer.ts`
   - Flow:
     1. Creates message record
     2. Analyzes caption for product info
     3. Triggers media processing if media present
     4. Updates related records

3. **Media Processing** (`_shared/media-processor.ts`)
   - Core media file handling
   - Uses: `media-validators.ts`, `telegram-service.ts`, `storage-manager.ts`
   - Flow:
     1. Downloads files from Telegram
     2. Validates MIME types and file integrity
     3. Uploads to Supabase storage
     4. Extracts video thumbnails from Telegram message data
     5. Creates/updates telegram_media records
     6. Handles media group relationships

4. **Media Group Handling** (`_shared/media-group-handler.ts`)
   - Manages related media items
   - Uses: `media-handler.ts`, `database-service.ts`
   - Flow:
     1. Groups related media items
     2. Syncs captions across group
     3. Updates product information

5. **Glide Synchronization** (`sync-glide-media-table/index.ts`)
   - Bidirectional sync with Glide
   - Uses: `database-service.ts`, `error-handler.ts`
   - Flow:
     1. Processes sync queue
     2. Maps data between systems
     3. Handles conflicts
     4. Records sync status

### Shared Functions Overview

1. **Data Management**
   - `database-service.ts`: Core database operations
   - `database-retry.ts`: Retry logic for database operations
   - `media-database.ts`: Media-specific database operations
   - `storage-manager.ts`: File storage operations

2. **Message Processing**
   - `message-processor.ts`: Main message handling
   - `message-manager.ts`: Message state management
   - `caption-analyzer.ts`: AI-powered caption analysis
   - `caption-sync.ts`: Syncs captions across media groups

3. **Media Handling**
   - `media-processor.ts`: Core media processing
   - `media-handler.ts`: Media state management
   - `media-validators.ts`: File validation
   - `media-group-handler.ts`: Media group operations
   - `metadata-extractor.ts`: Extracts media metadata

4. **Error Handling & Utilities**
   - `error-handler.ts`: Centralized error handling
   - `retry-utils.ts`: Retry mechanism utilities
   - `cleanup-manager.ts`: Resource cleanup
   - `sync-logger.ts`: Sync operation logging
   - `constants.ts`: Shared constants

5. **Integration Services**
   - `telegram-service.ts`: Telegram API integration
   - `telegram-types.ts`: Telegram type definitions

### Database Structure

1. **messages**
   - Primary message storage
   - Key fields:
     - message_id: Telegram message ID
     - chat_id: Telegram chat ID
     - caption: Message text
     - analyzed_content: Extracted product info

2. **telegram_media**
   - Media file records
   - Key fields:
     - file_id: Telegram file identifier
     - public_url: Supabase storage URL
     - thumbnail_url: Video preview URL from Telegram
     - telegram_media_row_id: Glide reference

3. **glide_sync_queue**
   - Sync operation tracking
   - Key fields:
     - record_id: Related media ID
     - operation: Sync operation type
     - processed_at: Completion timestamp

### Current Issues & Optimization Points

1. **Media Processing Flow**
   - Issue: Media not being added to telegram_media
   - Potential causes:
     - Webhook handler not properly utilizing media-processor.ts
     - Database timeout issues in database-service.ts
     - Error handling in media-handler.ts not properly managing retries

2. **Recommended Fixes**
   - Implement proper error propagation in webhook-handler.ts
   - Add additional logging in media-processor.ts
   - Review database-retry.ts implementation
   - Ensure proper utilization of cleanup-manager.ts

### Environment Variables Required

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GLIDE_API_TOKEN=
```

### Development Guidelines

1. **Error Handling**
   - Use error-handler.ts for consistent error management
   - Implement retry logic using retry-utils.ts
   - Log errors using sync-logger.ts

2. **Media Processing**
   - Validate files using media-validators.ts
   - Process groups using media-group-handler.ts
   - Extract metadata using metadata-extractor.ts

3. **Database Operations**
   - Use database-service.ts for core operations
   - Implement retry logic using database-retry.ts
   - Clean up using cleanup-manager.ts

4. **Monitoring**
   - Use sync-logger.ts for operation logging
   - Monitor sync_health_checks table
   - Review sync_performance_metrics