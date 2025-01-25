import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { TableSelector } from "./TableSelector";

interface ExistingTableTabProps {
  availableTables: string[];
  isCreating: boolean;
  onTableSelect: (table: string) => void;
  onLinkTable: () => Promise<void>;
  onClose: () => void;
  selectedTable: string;
}

export function ExistingTableTab({
  availableTables,
  isCreating,
  onTableSelect,
  onLinkTable,
  onClose,
  selectedTable,
}: ExistingTableTabProps) {
  return (
    <div className="space-y-4">
      <TableSelector
        availableTables={availableTables}
        selectedTable={selectedTable}
        onTableSelect={onTableSelect}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={onLinkTable}
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
    </div>
  );
}