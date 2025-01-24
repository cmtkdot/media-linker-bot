import { useEffect, useState } from "react";
import { InventorySliderGrid } from "@/components/inventory/InventorySliderGrid";
import { MediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export default function Inventory() {
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['telegram_media'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item): MediaItem => ({
        id: item.id,
        file_id: item.file_id,
        file_unique_id: item.file_unique_id,
        file_type: item.file_type,
        public_url: item.public_url,
        thumbnail_url: item.thumbnail_url,
        telegram_data: item.telegram_data || {},
        media_group_id: item.telegram_data?.message_data?.media_group_id,
        caption: item.telegram_data?.message_data?.caption,
        message_media_data: item.message_media_data || {},
        analyzed_content: item.analyzed_content || {},
        storage_path: item.storage_path,
        thumbnail_state: item.thumbnail_state || 'pending',
        thumbnail_source: item.thumbnail_source || null,
        thumbnail_error: item.thumbnail_error || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    }
  });

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold mb-8">Inventory</h1>
        <div className="text-red-500">Error loading inventory: {(error as Error).message}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold mb-8">Inventory</h1>
        <div className="animate-pulse">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Inventory</h1>
        <div className="text-sm text-muted-foreground">
          {items.length} items
        </div>
      </div>
      <InventorySliderGrid initialItems={items} />
    </div>
  );
}
