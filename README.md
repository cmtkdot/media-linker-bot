# Media Linker Bot

A Telegram bot that processes media messages, extracts information from captions, and manages media groups with synchronized metadata.

## Overview

This bot processes media messages from Telegram (photos, videos, documents) and manages them in a structured way using Supabase for storage and database operations.

## Features

- Media Processing
  - Handles photos, videos, and documents from Telegram
  - Supports media groups (multiple photos/videos in one message)
  - Automatic MIME type detection and validation
  - Secure file storage with size limits and type restrictions

- Caption Analysis
  - AI-powered caption analysis for metadata extraction
  - Extracts product information (name, code, quantity)
  - Synchronizes caption data across media groups

- Storage Management
  - Secure file storage in Supabase
  - Deduplication of files
  - Public URL generation for media access
  - Automatic cleanup of unused files

## Supabase Functions

### Core Functions

1. `telegram-webhook`
   - Handles incoming Telegram webhook events
   - Routes messages to appropriate handlers
   - Validates webhook data

2. `analyze-caption`
   - AI-powered caption analysis
   - Extracts structured data from message captions
   - Returns product information and metadata

3. `set-webhook`
   - Configures Telegram webhook settings
   - Sets up the bot's webhook URL

### Shared Components

Located in `supabase/functions/_shared/`:

- `media-processor.ts`: Main media file processing
- `caption-analyzer.ts`: Caption analysis and metadata extraction
- `storage-manager.ts`: File storage operations
- `database-service.ts`: Database operations
- `media-group-handler.ts`: Media group synchronization
- `telegram-service.ts`: Telegram API interactions

## Database Schema

### Tables

1. `messages`
   - Stores message metadata
   - Links to media files
   - Tracks processing status

2. `telegram_media`
   - Stores media file information
   - Links to storage files
   - Contains extracted metadata

## Setup and Deployment

1. Environment Variables:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

2. Deploy Supabase Functions:
   ```bash
   supabase functions deploy telegram-webhook
   supabase functions deploy analyze-caption
   supabase functions deploy set-webhook
   ```

3. Configure Telegram Webhook:
   ```bash
   supabase functions invoke set-webhook
   ```

## Media Group Processing

The bot handles media groups (multiple photos/videos sent together) with special care:

1. Each media item is processed individually first
2. Caption and metadata are synchronized across the group
3. Later items in a group can update earlier ones with new information
4. All items in a group share the same:
   - Caption
   - Product information
   - Metadata
   - Analysis results

## Error Handling

- Automatic retries for failed operations
- Exponential backoff for rate limits
- Detailed error logging
- Transaction support for data consistency

## Development

1. Local Development:
   ```bash
   supabase start
   supabase functions serve
   ```

2. Testing:
   ```bash
   # Run local tests
   supabase functions test
   ```

3. Deployment:
   ```bash
   # Deploy all functions
   supabase functions deploy
   ```

## Security

- File type validation
- Size limits (100MB max)
- Secure URL generation
- Access control via Supabase policies
- Environment variable protection

## Monitoring

- Detailed logging for all operations
- Error tracking and reporting
- Performance monitoring
- Storage usage tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - See LICENSE file for details