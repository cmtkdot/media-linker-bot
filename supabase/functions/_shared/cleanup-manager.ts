export async function cleanupFailedRecords(supabase: any) {
  try {
    console.log('Starting cleanup of failed records...');

    // Delete failed records older than 7 days
    const { error: deleteError } = await supabase
      .from('failed_webhook_updates')
      .delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (deleteError) {
      console.error('Error cleaning up failed records:', deleteError);
      return;
    }

    // Update status of resolved failed records
    const { error: updateError } = await supabase
      .from('failed_webhook_updates')
      .update({ status: 'resolved' })
      .eq('status', 'pending')
      .gt('retry_count', 0)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (updateError) {
      console.error('Error updating resolved failed records:', updateError);
      return;
    }

    console.log('Cleanup of failed records completed successfully');
  } catch (error) {
    console.error('Error in cleanupFailedRecords:', error);
  }
}