# Glide Sync System Documentation

## Protected Components (DO NOT MODIFY)

### Core Media Sync System
The following components are critical for the telegram media sync system and should not be modified:

#### Edge Functions
- `sync-glide-media-table`: Main bidirectional sync handler
  - Triggered by: Database changes, manual sync button
  - Uses: glide_sync_queue, telegram_media table
  
- `sync-missing-rows-to-glide`: Missing records checker
  - Triggered by: Manual check button, scheduled cron
  - Uses: telegram_media, glide_config tables

- `glide-supabase-sync-all`: Full table sync
  - Triggered by: Manual sync button
  - Uses: All related tables

#### Database Tables
- `glide_sync_queue`: Core sync operations queue
- `glide_config`: Glide table configurations
- `telegram_media`: Main media storage

#### Flow Diagram
```
[Database Change] → [glide_sync_queue] → [sync-glide-media-table] → [Glide API]
                                                ↓
                                        [Update telegram_media]

[Manual Sync] → [sync-missing-rows-to-glide] → [Check Differences] → [Queue Sync]
```

## Universal Webhook System (New Development)

### Naming Convention
- Tables: `glide_universal_*`
- Functions: `universal-glide-*`
- Configs: `universal_glide_*`

This new system operates independently of the protected media sync system and should be used for all new Glide table integrations.

### Components
- `glide_universal_webhooks`: Webhook configurations
- `webhook_calls`: Webhook call tracking
- `universal-glide-webhook`: Main webhook handler

### Integration Guidelines
1. Always use the `universal-` prefix for new functions
2. Keep separate from media sync system
3. Document all new endpoints in this README