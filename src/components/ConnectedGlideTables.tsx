import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NewGlideConfigForm } from "./NewGlideConfigForm";
import { TableLinkDialog } from "./TableLinkDialog";
import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";

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

interface ConnectedGlideTablesProps {
  configs: GlideConfig[];
  onRefresh: () => void;
}

export function ConnectedGlideTables({ configs, onRefresh }: ConnectedGlideTablesProps) {
  const [selectedConfig, setSelectedConfig] = useState<GlideConfig | null>(null);

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Connected Glide Tables</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Glide Table
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Glide Configuration</DialogTitle>
              </DialogHeader>
              <NewGlideConfigForm onSuccess={onRefresh} />
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-4">
          {configs?.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => setSelectedConfig(config)}
            >
              <div>
                <h3 className="font-medium">{config.table_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Table ID: {config.table_id}
                </p>
                <p className="text-sm text-muted-foreground">
                  Syncs with: {config.supabase_table_name || 'Not linked'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
                  config.active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {config.active ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Inactive
                    </>
                  )}
                </span>
                <div className="text-sm text-muted-foreground">
                  Last updated: {new Date(config.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TableLinkDialog 
        config={selectedConfig} 
        onClose={() => setSelectedConfig(null)}
        onSuccess={() => {
          setSelectedConfig(null);
          onRefresh();
        }}
      />
    </div>
  );
}