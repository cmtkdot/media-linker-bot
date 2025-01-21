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
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ValidTableName = "messages" | "failed_webhook_updates" | "glide_config" | "glide_sync_queue" | "telegram_media" | "duplicate_messages";

interface GlideConfig {
  id: string;
  table_name: string;
  active: boolean;
  supabase_table_name: string;
}

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isValidTable = (tableName: string): tableName is ValidTableName => {
    const validTables: ValidTableName[] = ["messages", "failed_webhook_updates", "glide_config", "glide_sync_queue", "telegram_media", "duplicate_messages"];
    return validTables.includes(tableName as ValidTableName);
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
      const { error } = await supabase
        .from(config.supabase_table_name)
        .insert([{ created_at: new Date().toISOString() }]);

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
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Record
          </Button>
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