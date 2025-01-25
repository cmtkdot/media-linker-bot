import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExistingTableTab } from "./table/ExistingTableTab";
import { NewTableForm } from "./table/NewTableForm";
import { Database } from "@/types/database";

interface GlideConfig {
  id: string;
  app_id: string;
  table_id: string;
  table_name: string;
  api_token: string;
  created_at: string;
  updated_at: string;
  active: boolean;
  supabase_table_name: string;
}

interface TableLinkDialogProps {
  config: GlideConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TableLinkDialog({ config, onClose, onSuccess }: TableLinkDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (config) {
      fetchAvailableTables();
    }
  }, [config]);

  const fetchAvailableTables = async () => {
    try {
      const { data: tablesData, error: tablesError } = await supabase
        .from('glide_config')
        .select('supabase_table_name')
        .not('supabase_table_name', 'is', null);

      if (tablesError) throw tablesError;

      const linkedTables = new Set(tablesData.map(d => d.supabase_table_name));

      const { data: allTables, error: allTablesError } = await supabase
        .from('get_all_tables')
        .select();

      if (allTablesError) throw allTablesError;

      const availableTables = (allTables || [])
        .map(t => t.table_name)
        .filter(table => 
          !linkedTables.has(table) && 
          !table.startsWith('_') && 
          !['schema_migrations', 'spatial_ref_sys'].includes(table)
        );

      setAvailableTables(availableTables);
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast({
        title: "Error",
        description: "Failed to fetch available tables",
        variant: "destructive",
      });
    }
  };

  const handleCreateTable = async () => {
    if (!config || !newTableName) return;

    setIsCreating(true);
    try {
      const { error: functionError } = await supabase
        .from('create_glide_sync_table')
        .select()
        .eq('table_name', newTableName)
        .single();

      if (functionError) throw functionError;

      const { error: updateError } = await supabase
        .from('glide_config')
        .update({ 
          supabase_table_name: `glide_${newTableName}`,
          active: true 
        })
        .eq('id', config.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Table created and linked successfully",
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Error creating table:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create and link table",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleLinkTable = async () => {
    if (!config || !selectedTable) return;

    setIsCreating(true);
    try {
      const { error: updateError } = await supabase
        .from('glide_config')
        .update({ 
          supabase_table_name: selectedTable,
          active: true 
        })
        .eq('id', config.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Table linked successfully",
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error linking table:', error);
      toast({
        title: "Error",
        description: "Failed to link table",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={!!config} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Table: {config?.table_name}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="existing">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Link Existing Table</TabsTrigger>
            <TabsTrigger value="new">Create New Table</TabsTrigger>
          </TabsList>

          <TabsContent value="existing">
            <ExistingTableTab
              availableTables={availableTables}
              isCreating={isCreating}
              onTableSelect={setSelectedTable}
              onLinkTable={handleLinkTable}
              onClose={onClose}
              selectedTable={selectedTable}
            />
          </TabsContent>

          <TabsContent value="new">
            <NewTableForm
              newTableName={newTableName}
              onTableNameChange={setNewTableName}
              onSubmit={handleCreateTable}
              isCreating={isCreating}
              onCancel={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}