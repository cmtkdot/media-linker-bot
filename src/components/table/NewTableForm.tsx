import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface NewTableFormProps {
  newTableName: string;
  onTableNameChange: (name: string) => void;
  onSubmit: () => Promise<void>;
  isCreating: boolean;
  onCancel: () => void;
}

export function NewTableForm({ 
  newTableName, 
  onTableNameChange, 
  onSubmit, 
  isCreating, 
  onCancel 
}: NewTableFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">New Table Name</label>
        <Input
          placeholder="Enter table name"
          value={newTableName}
          onChange={(e) => onTableNameChange(e.target.value)}
          className="mt-1"
        />
        <p className="text-sm text-muted-foreground mt-1">
          This will create a new table: glide_{newTableName}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
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
    </div>
  );
}