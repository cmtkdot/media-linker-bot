import { withDatabaseRetry } from './database-retry.ts';

export async function cleanupOldRecords(supabase: any) {
  console.log('Starting cleanup process');
  
  try {
    // First check if there are any active processes
    const { data: activeProcesses } = await supabase
      .from('messages')
      .select('id')
      .eq('status', 'pending')
      .limit(1);

    if (activeProcesses?.length > 0) {
      console.log('Active processes found, skipping cleanup');
      return;
    }

    // Proceed with cleanup using retry logic
    await withDatabaseRetry(async () => {
      // Clean up failed webhook updates older than 7 days
      const { error: webhookError } = await supabase
        .from('failed_webhook_updates')
        .delete()
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (webhookError) throw webhookError;

      // Clean up sync performance metrics older than 30 days
      const { error: metricsError } = await supabase
        .from('sync_performance_metrics')
        .delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (metricsError) throw metricsError;

      console.log('Cleanup completed successfully');
    }, 0, 'cleanup_old_records');

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}