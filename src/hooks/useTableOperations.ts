import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TableResult {
  table_name: string;
}

export function useTableOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchAvailableTables = async () => {
    try {
      const { data: tablesData, error: tablesError } = await supabase
        .from('glide_config')
        .select('supabase_table_name')
        .not('supabase_table_name', 'is', null);

      if (tablesError) throw tablesError;

      const linkedTables = new Set(tablesData.map(d => d.supabase_table_name));

      const { data: allTables, error: allTablesError } = await supabase
        .rpc<TableResult>('get_all_tables');

      if (allTablesError) throw allTablesError;

      return (allTables || [])
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
          supabase_table_name: `glide_${tableName}`,
          active: true 
        })
        .eq('id', configId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Table created and linked successfully",
      });
      
      return true;
    } catch (error: any) {
      console.error('Error creating table:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create and link table",
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

  return {
    isLoading,
    fetchAvailableTables,
    createAndLinkTable,
    linkExistingTable
  };
}