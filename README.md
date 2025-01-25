# Telegram Media Collection & Product Management System

## Core Processing Flow

### 1. Webhook Reception & Initial Processing
- **Entry Point**: `telegram-webhook/index.ts` (Edge Function)
  - Endpoint: `https://kzfamethztziwqiocbwz.supabase.co/functions/v1/telegram-webhook`
  - Validates incoming Telegram updates
  - Uses webhook-handler.ts for message creation
  - Immediately triggers caption analysis

### 2. Message Processing & Queue Management
- **Message Creation**:
  - Creates record in `messages` table with:
    ```typescript
    {
      message_id: number
      chat_id: number
      sender_info: Json
      telegram_data: Json
      caption: string | null
      media_group_id: string | null
      analyzed_content: Json
    }
    ```

- **Queue Integration** (via `queue_webhook_message` trigger):
  - Automatically queues processed messages in `unified_processing_queue`
  - Only queues messages after:
    - Caption analysis is complete
    - No processing errors exist
    - Status is 'pending'
  - Queue entry structure:
    ```typescript
    {
      queue_type: 'media' | 'webhook'
      data: {
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
          processed_at: string
          processing_error: string | null
        }
        meta: {
          created_at: string
          updated_at: string
          status: string
          retry_count: number
          last_retry_at: string | null
        }
      }
      status: 'pending' | 'processed' | 'error'
      priority: number
      correlation_id: string
    }
    ```

### 3. Media Processing System
- **Process Media Queue** (Edge Function):
  - Endpoint: `https://kzfamethztziwqiocbwz.supabase.co/functions/v1/process-media-queue`
  - Processes pending items from unified_processing_queue
  - Handles both individual media and media groups
  - Runs every minute via cron job

- **Media Group Processing**:
  - Groups items by media_group_id
  - Ensures all group items are synced before processing
  - Shares analyzed content across group members
  - Updates all related records simultaneously

- **Media Storage Flow**:
  1. Downloads media from Telegram
  2. Validates file integrity
  3. Uploads to Supabase storage
  4. Creates/updates telegram_media records
  5. Updates queue status

### 4. Data Structure & Storage
- **telegram_media Table Structure**:
  ```typescript
  {
    id: string
    file_id: string
    file_unique_id: string
    file_type: string
    public_url: string | null
    message_id: string
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
      }
      meta: {
        created_at: string
        updated_at: string
        status: string
        error: string | null
      }
      media: {
        file_id: string
        file_unique_id: string
        file_type: string
        public_url: string
      }
    }
  }
  ```

### 5. Caption Analysis System
- **Analysis Trigger**: `analyze-caption` Edge Function
  - Endpoint: `https://kzfamethztziwqiocbwz.supabase.co/functions/v1/analyze-caption`
  - Uses GPT-4 for intelligent caption parsing
  - Extracts structured product information:
    ```typescript
    {
      product_name: string
      product_code?: string
      quantity?: number
      vendor_uid?: string
      purchase_date?: string
      notes?: string
      analyzed_content: {
        raw_text: string
        extracted_data: Record<string, any>
        confidence: number
        timestamp: string
        model_version: string
      }
    }
    ```

### 6. Error Handling & Retry Logic
- Implements retry mechanism for failed operations
- Tracks retry counts and timestamps
- Maximum retry attempts configurable per queue type
- Detailed error logging in processing_error fields

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
1. **Queue Management**:
   - Use unified_processing_queue for all async operations
   - Implement proper error handling and retries
   - Monitor queue performance and bottlenecks

2. **Media Processing**:
   - Validate files before storage
   - Maintain group relationships
   - Handle caption syncing efficiently

3. **Database Operations**:
   - Use provided service functions
   - Implement proper error handling
   - Follow existing naming conventions

4. **Monitoring**:
   - Check Edge Function logs regularly
   - Monitor queue performance
   - Track processing errors