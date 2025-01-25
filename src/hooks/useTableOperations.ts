import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GlideConfig } from "@/types/glide";

interface TableOperationsResult {
  isLoading: boolean;
  fetchAvailableTables: () => Promise<string[]>;
  createAndLinkTable: (configId: string, tableName: string) => Promise<boolean>;
  linkExistingTable: (configId: string, tableName: string) => Promise<boolean>;
  retryPendingMessages: () => Promise<void>;
}

interface Message {
  id: string;
  status: 'pending' | 'processed' | 'error';
  retry_count: number;
  correlation_id: string;
  processing_error?: string | null;
  last_retry_at?: string | null;
  analyzed_content?: Record<string, any> | null;
}

export function useTableOperations(): TableOperationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAvailableTables = async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase.rpc('get_all_tables');
      
      if (error) throw error;
      
      return data.map((row: { table_name: string }) => row.table_name)
        .filter((name: string) => !name.startsWith('_'));
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

  const createAndLinkTable = async (configId: string, tableName: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Create the table
      const { error: createError } = await supabase.rpc('create_glide_sync_table', {
        p_table_name: tableName
      });

      if (createError) throw createError;

      // Update the config with the new table name
      const { error: updateError } = await supabase
        .from('glide_config')
        .update({
          active: true,
          supabase_table_name: tableName
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

  const linkExistingTable = async (configId: string, tableName: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('glide_config')
        .update({
          active: true,
          supabase_table_name: tableName
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
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      if (!pendingMessages?.length) {
        toast({
          title: "Info",
          description: "No pending messages found",
        });
        return;
      }

      let processedCount = 0;
      let errorCount = 0;

      for (const message of pendingMessages as Message[]) {
        // Skip if max retries reached (default to 3)
        if (message.retry_count >= 3) {
          // Update to error status if max retries reached
          const { error: errorUpdate } = await supabase
            .from('messages')
            .update({
              status: 'error',
              processing_error: 'Max retry attempts reached',
              updated_at: new Date().toISOString(),
              last_retry_at: new Date().toISOString(),
            })
            .eq('id', message.id);

          if (errorUpdate) {
            console.error(`Error updating message ${message.id} to error status:`, errorUpdate);
          }
          errorCount++;
          continue;
        }

        // Update retry count and timestamp for pending messages
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            retry_count: (message.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Keep existing correlation_id
            correlation_id: message.correlation_id,
            // Maintain pending status to allow for processing
            status: 'pending'
          })
          .eq('id', message.id);

        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError);
          errorCount++;
        } else {
          processedCount++;
        }
      }

      toast({
        title: "Success",
        description: `Retried ${processedCount} messages (${errorCount} errors)`,
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