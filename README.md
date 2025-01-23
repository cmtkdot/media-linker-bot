# Telegram Media Collection & Product Management System

A web application that automatically collects, processes, and manages media from Telegram channels while linking them to product data in Glide.

## System Architecture

### Message Processing Flow

1. **Webhook Reception**
   - Telegram sends updates to `/telegram-webhook` endpoint
   - Webhook validates secret token and extracts message data
   - Initial logging and validation occurs

2. **Caption Analysis**
   - If message contains caption, it's analyzed using OpenAI
   - Extracts product information (name, code, quantity, etc.)
   - Results stored in `analyzed_content`

3. **Message Processing**
   - Message data saved to `messages` table
   - Includes metadata, sender info, and analyzed content
   - Media group handling for multiple files

4. **Media Processing**
   - Files downloaded from Telegram
   - Uploaded to Supabase storage
   - Metadata extracted (especially for videos)
   - Thumbnails generated for videos
   - Records created in `telegram_media` table

5. **Glide Synchronization**
   - Changes trigger sync queue entries
   - Bidirectional sync with Glide
   - Handles creates, updates, and deletes

### Database Structure

- **messages**: Stores raw message data and parsed information
- **telegram_media**: Contains media file references and metadata
- **glide_sync_queue**: Manages pending sync operations
- **failed_webhook_updates**: Tracks failed processing attempts

### Key Components

- **Webhook Handler**: `telegram-webhook/index.ts`
- **Media Processor**: `_shared/media-processor.ts`
- **Caption Analyzer**: `_shared/caption-analyzer.ts`
- **Error Handler**: `_shared/error-handler.ts`
- **Database Service**: `_shared/database-service.ts`

## Features

- Automatic media collection from Telegram channels
- Advanced caption analysis for product information
- Video thumbnail generation
- Bidirectional Glide synchronization
- Media management dashboard
- Advanced filtering and search
- Product linking interface

## Tech Stack

- **Frontend**
  - React with TypeScript
  - Tailwind CSS for styling
  - shadcn/ui components
  - Tanstack Query for data management

- **Backend**
  - Supabase for database and storage
  - Edge Functions for serverless processing
  - OpenAI for caption analysis

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

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Start development server: `npm run dev`

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

- Retry mechanism for failed operations
- Error logging in `failed_webhook_updates`
- Performance monitoring via `sync_performance_metrics`
- Health checks through `sync_health_checks`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is private and confidential.