import { InventorySliderGrid } from "@/components/inventory/InventorySliderGrid";
import { createClient } from "@/lib/supabase/client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InventoryPage() {
  const supabase = createClient();

  // Fetch media items with their related data
  const { data: mediaItems, error } = await supabase
    .from('media_items')
    .select(`
      *,
      product:products(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching media items:', error);
    return (
      <main className="container mx-auto p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-6">Inventory Gallery</h1>
        <p className="text-red-500">Error loading media items. Please try again later.</p>
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
