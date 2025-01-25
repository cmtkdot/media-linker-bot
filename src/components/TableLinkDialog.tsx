import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useTableOperations } from "@/hooks/useTableOperations";
import { TableLinkDialogContent } from "./table/TableLinkDialogContent";
import { GlideConfig } from "@/types/glide";

interface TableLinkDialogProps {
  config: GlideConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TableLinkDialog({ config, onClose, onSuccess }: TableLinkDialogProps) {
  const [newTableName, setNewTableName] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const { isLoading, fetchAvailableTables, createAndLinkTable, linkExistingTable } = useTableOperations();

  useEffect(() => {
    if (config) {
      loadAvailableTables();
    }
  }, [config]);

  const loadAvailableTables = async () => {
    const tables = await fetchAvailableTables();
    setAvailableTables(tables);
  };

  const handleCreateTable = async () => {
    if (!config || !newTableName) return;
    
    const success = await createAndLinkTable(config.id, newTableName);
    if (success) {
      onSuccess();
    }
  };

  const handleLinkTable = async () => {
    if (!config || !selectedTable) return;
    
    const success = await linkExistingTable(config.id, selectedTable);
    if (success) {
      onSuccess();
    }
  };

  return (
    <TableLinkDialogContent
      config={config}
      availableTables={availableTables}
      isCreating={isLoading}
      selectedTable={selectedTable}
      onTableSelect={setSelectedTable}
      onCreateTable={handleCreateTable}
      onLinkTable={handleLinkTable}
      onClose={onClose}
      newTableName={newTableName}
      onTableNameChange={setNewTableName}
    />
  );
}