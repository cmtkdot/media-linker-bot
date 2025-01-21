import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { GlideSyncHeader } from "@/components/GlideSyncHeader";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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

const GlideSync = () => {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['glide-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glide_config')
        .select('*')
        .order('table_name');
      
      if (error) throw error;
      return data as GlideConfig[];
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Glide Sync Settings</h1>
        <Button variant="outline" asChild>
          <Link to="/glide-connections">Manage Connections</Link>
        </Button>
      </div>
      <GlideSyncHeader configs={configs || []} isLoading={isLoading} />
    </div>
  );
};

export default GlideSync;