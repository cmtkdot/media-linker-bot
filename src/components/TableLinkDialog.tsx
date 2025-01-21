import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
  const { toast } = useToast();

  const handleCreateTable = async () => {
    if (!config || !newTableName) return;

    setIsCreating(true);
    try {
      // Call the create_glide_sync_table function
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
    } catch (error) {
      console.error('Error creating table:', error);
      toast({
        title: "Error",
        description: "Failed to create and link table",
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
        
        <div className="space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}