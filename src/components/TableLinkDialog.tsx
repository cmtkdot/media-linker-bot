import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface TableResult {
  table_name: string;
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
      // Get all tables from Supabase
      const { data: tablesData, error: tablesError } = await supabase
        .from('glide_config')
        .select('supabase_table_name')
        .not('supabase_table_name', 'is', null);

      if (tablesError) throw tablesError;

      // Get list of linked tables
      const linkedTables = new Set(tablesData.map(d => d.supabase_table_name));

      // Get all tables in the database
      const { data: allTables, error: allTablesError } = await supabase
        .rpc('get_all_tables') as { data: TableResult[] | null, error: any };

      if (allTablesError) throw allTablesError;

      // Filter out system tables and already linked tables
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
      // First create the table using the RPC function
      const { error: functionError } = await supabase.rpc(
        'create_glide_sync_table',
        { table_name: newTableName }
      );

      if (functionError) throw functionError;

      // Update the glide_config with the new table name and set active to true
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

          <TabsContent value="existing" className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Table</label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleLinkTable}
                disabled={!selectedTable || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Linking...
                  </>
                ) : (
                  'Link Table'
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Table Name</label>
              <Input
                placeholder="Enter table name"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This will create a new table: glide_{newTableName}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTable}
                disabled={!newTableName || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Link Table'
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}