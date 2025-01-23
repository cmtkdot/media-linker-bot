import { Button } from "@/components/ui/button";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash } from "lucide-react";
import { MediaItem } from "@/types/media";
import MediaEditFormField from "./MediaEditFormField";

interface MediaEditDialogContentProps {
  editItem: MediaItem;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  generateCaption: (item: MediaItem) => string;
}

const MediaEditDialogContent = ({
  editItem,
  onClose,
  onDelete,
  onSave,
  onItemChange,
  generateCaption
}: MediaEditDialogContentProps) => {
  const handleCaptionUpdate = (item: MediaItem) => {
    if (editItem.analyzed_content?.text === editItem.caption) {
      onItemChange('caption', generateCaption(item));
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Edit Media</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <MediaEditFormField
          label="Caption"
          id="caption"
          value={editItem.caption || ''}
          field="caption"
          onChange={(value) => onItemChange('caption', value)}
          editItem={editItem}
        />
        <MediaEditFormField
          label="Product Name"
          id="product_name"
          value={editItem.product_name || ''}
          field="product_name"
          onChange={(value) => onItemChange('product_name', value)}
          onCaptionUpdate={handleCaptionUpdate}
          editItem={editItem}
        />
        <MediaEditFormField
          label="Product Code"
          id="product_code"
          value={editItem.product_code || ''}
          field="product_code"
          onChange={(value) => onItemChange('product_code', value)}
          onCaptionUpdate={handleCaptionUpdate}
          editItem={editItem}
        />
        <MediaEditFormField
          label="Quantity"
          id="quantity"
          type="number"
          value={editItem.quantity || ''}
          field="quantity"
          onChange={(value) => onItemChange('quantity', value)}
          onCaptionUpdate={handleCaptionUpdate}
          editItem={editItem}
        />
        <MediaEditFormField
          label="Vendor UID"
          id="vendor_uid"
          value={editItem.vendor_uid || ''}
          field="vendor_uid"
          onChange={(value) => onItemChange('vendor_uid', value)}
          onCaptionUpdate={handleCaptionUpdate}
          editItem={editItem}
        />
        <MediaEditFormField
          label="Purchase Date"
          id="purchase_date"
          type="date"
          value={editItem.purchase_date || ''}
          field="purchase_date"
          onChange={(value) => onItemChange('purchase_date', value)}
          editItem={editItem}
        />
        <MediaEditFormField
          label="Notes"
          id="notes"
          value={editItem.notes || ''}
          field="notes"
          onChange={(value) => onItemChange('notes', value)}
          editItem={editItem}
        />
      </div>
      <div className="flex justify-between">
        <Button
          variant="destructive"
          onClick={onDelete}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          <Trash className="w-4 h-4 mr-2" />
          Delete
        </Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            Save changes
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};

export default MediaEditDialogContent;