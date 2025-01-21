import React from "react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MediaItem {
  id: string;
  public_url: string;
  file_type: string;
  caption?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  created_at: string;
}

const MediaGrid = () => {
  const { data: mediaItems, isLoading, error } = useQuery({
    queryKey: ['telegram-media'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MediaItem[];
    }
  });

  if (isLoading) {
    return <div className="text-center p-4">Loading media...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error loading media</div>;
  }

  if (!mediaItems?.length) {
    return <div className="text-center p-4">No media items found</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {mediaItems.map((item) => (
        <Card key={item.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
          <div className="aspect-square relative">
            {item.file_type === 'video' ? (
              <video 
                src={item.public_url}
                className="object-cover w-full h-full"
                controls
              />
            ) : (
              <img
                src={item.public_url || "/placeholder.svg"}
                alt={item.caption || "Media item"}
                className="object-cover w-full h-full"
              />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-4">
              <div className="text-white">
                {item.caption && <p className="font-medium mb-2">{item.caption}</p>}
                {item.product_name && <p className="text-sm">{item.product_name}</p>}
                {item.product_code && <p className="text-sm">#{item.product_code}</p>}
                {item.quantity && <p className="text-sm">Quantity: {item.quantity}</p>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default MediaGrid;