import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { GlideConfig } from "@/types/glide";

type ValidTableName = "messages" | "failed_webhook_updates" | "glide_config" | "glide_sync_queue" | "telegram_media";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isValidTable = (tableName: string): tableName is ValidTableName => {
    const validTables: ValidTableName[] = ["messages", "failed_webhook_updates", "glide_config", "glide_sync_queue", "telegram_media"];
    return validTables.includes(tableName as ValidTableName);
  };

  const getDefaultInsertData = (tableName: ValidTableName): Database['public']['Tables'][ValidTableName]['Insert'] => {
    const base = { created_at: new Date().toISOString() };
    
    switch (tableName) {
      case "telegram_media":
        return {
          file_id: "",
          file_type: "photo",
          file_unique_id: "",
          telegram_data: {},
          glide_data: {},
          media_metadata: {},
          ...base
        };
      case "messages":
        return {
          message_id: 0,
          chat_id: 0,
          sender_info: {},
          message_type: "text",
          message_data: {},
          ...base
        };
      case "failed_webhook_updates":
        return {
          error_message: "New record",
          ...base
        };
      case "glide_config":
        return {
          app_id: "",
          table_id: "",
          table_name: "",
          api_token: "",
          ...base
        };
      case "glide_sync_queue":
        return {
          table_name: "",
          record_id: "",
          operation: "INSERT",
          ...base
        };
      default:
        throw new Error(`Invalid table name: ${tableName}`);
    }
  };

  const { data: tableData, isLoading } = useQuery({
    queryKey: ['table-data', selectedConfig],
    enabled: !!selectedConfig,
    queryFn: async () => {
      const config = configs.find(c => c.id === selectedConfig);
      if (!config?.supabase_table_name || !isValidTable(config.supabase_table_name)) {
        throw new Error("Invalid table name");
      }
      
      const { data, error } = await supabase
        .from(config.supabase_table_name)
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (!selectedConfig) return;

    const config = configs.find(c => c.id === selectedConfig);
    if (!config?.supabase_table_name || !isValidTable(config.supabase_table_name)) return;

    const channel = supabase.channel('table-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: config.supabase_table_name
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['table-data', selectedConfig] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConfig, queryClient]);

  const handleSync = async () => {
    if (!selectedConfig) {
      toast({
        title: "No table selected",
        description: "Please select a table to sync",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-glide-media-table', {
        body: { operation: 'syncBidirectional', tableId: selectedConfig }
      });

      if (error) throw error;

      toast({
        title: "Sync Completed",
        description: `Added: ${data.added}, Updated: ${data.updated}, Deleted: ${data.deleted}`,
      });

      if (data.errors?.length > 0) {
        console.error('Sync errors:', data.errors);
        toast({
          title: "Sync Completed with Errors",
          description: "Check console for details",
          variant: "destructive",
        });
      }

      // Refresh the table data after sync
      queryClient.invalidateQueries({ queryKey: ['table-data', selectedConfig] });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = (row: any) => {
    setEditingId(row.id);
    setEditData({ ...row });
  };

  const handleSave = async () => {
    if (!editData || !selectedConfig) return;

    const config = configs.find(c => c.id === selectedConfig);
    if (!config?.supabase_table_name || !isValidTable(config.supabase_table_name)) return;

    try {
      const { error } = await supabase
        .from(config.supabase_table_name)
        .update(editData)
        .eq('id', editingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      setEditingId(null);
      setEditData(null);
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        title: "Error",
        description: "Failed to update record",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedConfig) return;

    const config = configs.find(c => c.id === selectedConfig);
    if (!config?.supabase_table_name || !isValidTable(config.supabase_table_name)) return;

    try {
      const { error } = await supabase
        .from(config.supabase_table_name)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Record deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: "Error",
        description: "Failed to delete record",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async () => {
    if (!selectedConfig) return;

    const config = configs.find(c => c.id === selectedConfig);
    if (!config?.supabase_table_name || !isValidTable(config.supabase_table_name)) return;

    try {
      const defaultData = getDefaultInsertData(config.supabase_table_name);
      const { error } = await supabase
        .from(config.supabase_table_name)
        .insert([defaultData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "New record added successfully",
      });
    } catch (error) {
      console.error('Error adding record:', error);
      toast({
        title: "Error",
        description: "Failed to add new record",
        variant: "destructive",
      });
    }
  };

  if (!configs.length) return null;

  const activeConfigs = configs.filter(config => config.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          className="border rounded p-2"
          value={selectedConfig}
          onChange={(e) => setSelectedConfig(e.target.value)}
        >
          <option value="">Select a table</option>
          {activeConfigs.map((config) => (
            <option key={config.id} value={config.id}>
              {config.table_name}
            </option>
          ))}
        </select>
        {selectedConfig && (
          <>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </Button>
            <Button 
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync with Glide
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {selectedConfig && tableData && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {Object.keys(tableData[0] || {}).map((key) => (
                  <TableHead key={key}>{key}</TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row: any) => (
                <TableRow key={row.id}>
                  {Object.entries(row).map(([key, value]) => (
                    <TableCell key={key}>
                      {editingId === row.id ? (
                        <Input
                          value={editData[key] || ''}
                          onChange={(e) =>
                            setEditData({ ...editData, [key]: e.target.value })
                          }
                        />
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingId === row.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSave}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditData(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

