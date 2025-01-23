export async function cleanupFailedRecords(supabase: any) {
  console.log('Starting cleanup of failed records...');

  try {
    const { error: deleteError } = await supabase
      .from('failed_webhook_updates')
      .delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (deleteError) throw deleteError;

    const { error: updateError } = await supabase
      .from('failed_webhook_updates')
      .update({ status: 'resolved' })
      .eq('status', 'pending')
      .gt('retry_count', 0)
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (updateError) throw updateError;

    console.log('Cleanup of failed records completed successfully');
  } catch (error) {
    console.error('Error in cleanupFailedRecords:', error);
    throw error;
  }
}