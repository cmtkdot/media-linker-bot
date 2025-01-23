import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import type { FailedWebhookUpdate, GlideConfig } from "@/types/glide";

interface GlideDataGridProps {
  configs: GlideConfig[];
}

export function GlideDataGrid({ configs }: GlideDataGridProps) {
  const { data: failedUpdates, isLoading } = useQuery({
    queryKey: ['failed-webhook-updates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('failed_webhook_updates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FailedWebhookUpdate[];
    }
  });

  return (
    <div className="rounded-md border">
      <DataTable columns={columns} data={failedUpdates || []} />
    </div>
  );
}