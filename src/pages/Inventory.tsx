import { useEffect, useState } from "react";
import { InventorySliderGrid } from "@/components/inventory/InventorySliderGrid";
import { createClient } from "@/lib/supabase/client";
import { MediaItem } from "@/types/media";

export default function Inventory() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchMediaItems() {
      const { data, error } = await supabase
        .from('media_items')
        .select(`
          *,
          product:products(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching media items:', error);
        setError('Error loading media items. Please try again later.');
        return;
      }

      setMediaItems(data || []);
    }

    fetchMediaItems();
  }, []);

  if (error) {
    return (
      <main className="container mx-auto p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-6">Inventory Gallery</h1>
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory Gallery</h1>
        <p className="text-sm text-muted-foreground">
          {mediaItems.length} items
        </p>
      </div>
      <InventorySliderGrid initialItems={mediaItems} />
    </main>
  );
}
