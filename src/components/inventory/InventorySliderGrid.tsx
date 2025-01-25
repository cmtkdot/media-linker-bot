import { useState } from "react";
import { MediaItem } from "@/types/media";
import { InventoryViewer } from "./InventoryViewer";
import { EditMediaDialog } from "./EditMediaDialog";
import { InventoryCard } from "./InventoryCard";

interface InventorySliderGridProps {
  initialItems: MediaItem[];
}

export const InventorySliderGrid = ({ initialItems }: InventorySliderGridProps) => {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);

  const handlePreview = (item: MediaItem) => {
    setSelectedItem(item);
  };

  const handleEdit = (item: MediaItem) => {
    setEditItem(item);
  };

  const handleEditComplete = async (updatedItem: MediaItem) => {
    setEditItem(null);
    // Trigger refetch or update local state as needed
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {initialItems.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            onPreview={() => handlePreview(item)}
            onEdit={() => handleEdit(item)}
          />
        ))}
      </div>

      {selectedItem && (
        <InventoryViewer
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
          media={selectedItem}
        />
      )}

      {editItem && (
        <EditMediaDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          item={editItem}
          onSave={handleEditComplete}
        />
      )}
    </div>
  );
};