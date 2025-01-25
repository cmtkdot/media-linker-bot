import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TableSelectorProps {
  availableTables: string[];
  selectedTable: string;
  onTableSelect: (table: string) => void;
}

export function TableSelector({ availableTables, selectedTable, onTableSelect }: TableSelectorProps) {
  return (
    <div>
      <label className="text-sm font-medium">Select Table</label>
      <Select value={selectedTable} onValueChange={onTableSelect}>
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
  );
}