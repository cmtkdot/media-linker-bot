import { ConnectedGlideTables } from "@/components/ConnectedGlideTables";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GlideConfig } from "@/types/glide";

const GlideConnections = () => {
  const { data: configs, isLoading, refetch } = useQuery({
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
        <h1 className="text-2xl font-semibold">Connected Glide Tables</h1>
        <Button variant="outline" asChild>
          <Link to="/glide-sync">Go to Sync Settings</Link>
        </Button>
      </div>
      <ConnectedGlideTables configs={configs || []} onRefresh={refetch} />
    </div>
  );
};

export default GlideConnections;