import DashboardLayout from "@/components/DashboardLayout";
import { GlideSyncHeader } from "@/components/GlideSyncHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const GlideSync = () => {
  const { data: configs, isLoading, refetch } = useQuery({
    queryKey: ['glide-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_config')
        .select('*')
        .order('table_name');
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Glide Sync</h1>
          <Button variant="outline" asChild>
            <Link to="/glide-connections">Manage Connections</Link>
          </Button>
        </div>
        <GlideSyncHeader configs={configs || []} isLoading={isLoading} />
      </div>
    </DashboardLayout>
  );
};

export default GlideSync;