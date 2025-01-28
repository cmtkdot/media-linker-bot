# Telegram Media Collection & Product Management System

## Core Processing Flow

### 1. Webhook Reception & Initial Processing
- Endpoint: `telegram-webhook`
- Validates incoming updates
- Analyzes captions using `analyze-caption`
- Creates message records with analyzed content

### 2. Queue Management
- Messages queued in `unified_processing_queue`
- Queue types: 'media', 'media_group', 'webhook'
- Handles prioritization and retry logic

### 3. Media Processing
- `process-media-queue` handles all media processing
- Groups media items by media_group_id
- Downloads media from Telegram
- Uploads to Supabase storage
- Updates telegram_media records

### 4. Glide Integration
- `sync-glide-media-table` manages all Glide sync operations
- Bidirectional sync between Supabase and Glide
- Handles batch operations and error recovery

## Required Environment Variables
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GLIDE_API_TOKEN=
```

## Development Guidelines
1. Queue Management:
   - Use unified_processing_queue for async operations
   - Implement proper error handling
   - Monitor queue performance

2. Media Processing:
   - Validate files before storage
   - Maintain group relationships
   - Handle caption syncing

3. Database Operations:
   - Use service functions
   - Follow naming conventions
   - Implement proper error handling

4. Monitoring:
   - Check Edge Function logs
   - Monitor queue performance
   - Track processing errors
