import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExistingTableTab } from "./ExistingTableTab";
import { NewTableForm } from "./NewTableForm";
import { GlideConfig } from "@/types/glide";

interface TableLinkDialogContentProps {
  config: GlideConfig | null;
  availableTables: string[];
  isCreating: boolean;
  selectedTable: string;
  onTableSelect: (table: string) => void;
  onCreateTable: () => Promise<void>;
  onLinkTable: () => Promise<void>;
  onClose: () => void;
  newTableName: string;
  onTableNameChange: (name: string) => void;
}

export function TableLinkDialogContent({
  config,
  availableTables,
  isCreating,
  selectedTable,
  onTableSelect,
  onCreateTable,
  onLinkTable,
  onClose,
  newTableName,
  onTableNameChange,
}: TableLinkDialogContentProps) {
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
              onTableSelect={onTableSelect}
              onLinkTable={onLinkTable}
              onClose={onClose}
              selectedTable={selectedTable}
            />
          </TabsContent>

          <TabsContent value="new">
            <NewTableForm
              newTableName={newTableName}
              onTableNameChange={onTableNameChange}
              onSubmit={onCreateTable}
              isCreating={isCreating}
              onCancel={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}