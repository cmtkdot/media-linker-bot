# Telegram Media Collection & Product Management System

## System Overview

This system provides bidirectional synchronization between Telegram media messages and a Glide database, with automated caption analysis and product data extraction.

### Key Features

- Bidirectional sync between Telegram and Glide
- Automated caption analysis using OpenAI
- Media group handling and synchronization
- Real-time product data extraction
- Flexible message processing queue
- Robust error handling and retry logic

## Core Processing Flow

### 1. Message Reception & Initial Processing
- Webhook endpoint receives Telegram updates
- Immediate caption analysis via OpenAI
- Message creation with analyzed content
- No dependency on original messages (supports bidirectional sync)

### 2. Queue Management
```typescript
{
  queue_type: 'media' | 'media_group' | 'webhook'
  message_media_data: {
    message: { /* message details */ },
    sender: { /* sender info */ },
    analysis: { /* analyzed content */ },
    meta: { /* processing metadata */ }
  }
  status: 'pending' | 'processing' | 'completed' | 'failed'
}
```

### 3. Media Processing
- Downloads media from Telegram
- Uploads to Supabase storage
- Creates/updates telegram_media records
- Handles media groups without original message constraints
- Maintains caption relationships without foreign key dependencies

### 4. Storage Management
- Public media bucket with secure access controls
- Automatic file cleanup for deleted media
- Proper MIME type handling
- Sanitized file names and paths
- Efficient storage organization

### 5. Glide Integration
- Bidirectional sync with Glide tables
- Real-time updates in both directions
- Batch processing support
- Error recovery and retry logic

## Data Flow Architecture

```
[Telegram Webhook] → [Caption Analysis] → [Messages Table]
           ↓                                     ↓
[Processing Queue] → [Media Processing] → [Telegram Media]
           ↓                                     ↓
[Storage Upload] ←→ [Glide Sync] ←→ [Glide Database]
```

## Key Components

### Database Tables
- `messages`: Stores incoming Telegram messages
- `telegram_media`: Processed media files and metadata
- `unified_processing_queue`: Manages async operations
- `glide_sync_queue`: Handles Glide synchronization

### Storage
- Bucket: `media`
- Access: Public with authenticated upload/delete
- File Types: Images (JPEG), Videos (MP4), Documents
- Path Format: `{file_unique_id}.{extension}`

### Edge Functions
- `telegram-webhook`: Entry point for Telegram updates
- `process-media-queue`: Handles media processing
- `sync-glide-media-table`: Manages Glide synchronization

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

### 1. Message Processing
- Handle messages independently
- Don't assume original messages exist
- Use correlation IDs for tracking
- Implement proper error handling

### 2. Media Groups
- Process media groups as atomic units
- Share analyzed content across group
- Track original captions without constraints
- Handle partial group updates

### 3. Storage Operations
- Sanitize file names
- Set proper MIME types
- Handle upload retries
- Validate file integrity

### 4. Database Operations
- Use service functions for consistency
- Implement proper error handling
- Follow naming conventions
- Handle conflicts gracefully

### 5. Monitoring
- Check Edge Function logs
- Monitor queue performance
- Track processing errors
- Review sync status

## Error Handling

### Retry Logic
```typescript
{
  retry_count: number
  max_retries: number
  error_message: string
  last_retry: timestamp
}
```

### Common Error Scenarios
1. Media download failures
2. Storage upload issues
3. Glide API timeouts
4. Caption analysis errors

## Maintenance Tasks

### Daily Operations
- Monitor queue processing
- Check error logs
- Review sync status
- Clean up processed items

### Weekly Tasks
- Review failed items
- Check storage usage
- Validate Glide connections
- Update API tokens if needed

## Contributing

1. Follow TypeScript conventions
2. Maintain error handling
3. Update documentation
4. Test thoroughly

For detailed API documentation and additional information, refer to the [API Documentation](./API.md).