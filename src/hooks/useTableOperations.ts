import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TableResult {
  table_name: string;
}

export function useTableOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAvailableTables = async () => {
    try {
      const { data: tablesData } = await supabase
        .from('glide_config')
        .select('supabase_table_name');

      const linkedTables = new Set(tablesData?.map(d => d.supabase_table_name) || []);

      const { data: allTables, error: allTablesError } = await supabase
        .rpc('get_all_tables');

      if (allTablesError) throw allTablesError;

      return ((allTables || []) as TableResult[])
        .filter(table => 
          !linkedTables.has(table.table_name) && 
          !table.table_name.startsWith('_') && 
          !['schema_migrations', 'spatial_ref_sys'].includes(table.table_name)
        )
        .map(t => t.table_name);
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast({
        title: "Error",
        description: "Failed to fetch available tables",
        variant: "destructive",
      });
      return [];
    }
  };

  const createAndLinkTable = async (configId: string, tableName: string) => {
    setIsLoading(true);
    try {
      const { error: functionError } = await supabase
        .rpc('create_glide_sync_table', { p_table_name: tableName });

      if (functionError) throw functionError;

      const { error: updateError } = await supabase
        .from('glide_config')
        .update({ 
          supabase_table_name: tableName,
          active: true 
        })
        .eq('id', configId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Table created and linked successfully",
      });

      return true;
    } catch (error) {
      console.error('Error creating and linking table:', error);
      toast({
        title: "Error",
        description: "Failed to create and link table",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const linkExistingTable = async (configId: string, tableName: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('glide_config')
        .update({ 
          supabase_table_name: tableName,
          active: true 
        })
        .eq('id', configId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Table linked successfully",
      });

      return true;
    } catch (error) {
      console.error('Error linking table:', error);
      toast({
        title: "Error",
        description: "Failed to link table",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const retryPendingMessages = async () => {
    setIsLoading(true);
    try {
      const { data: pendingMessages, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('status', 'pending')
        .is('processing_error', null)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      if (!pendingMessages || pendingMessages.length === 0) {
        toast({
          title: "Info",
          description: "No pending messages found to retry",
        });
        return;
      }

      for (const message of pendingMessages) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            retry_count: (message.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
          })
          .eq('id', message.id);

        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError);
        }
      }

      toast({
        title: "Success",
        description: `Retried ${pendingMessages.length} pending messages`,
      });
    } catch (error) {
      console.error('Error retrying pending messages:', error);
      toast({
        title: "Error",
        description: "Failed to retry pending messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    fetchAvailableTables,
    createAndLinkTable,
    linkExistingTable,
    retryPendingMessages
  };
}