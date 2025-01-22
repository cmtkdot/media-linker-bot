import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaEditDialog = ({ editItem, onClose, onSave, onItemChange, formatDate }: MediaEditDialogProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Media deleted",
        description: "The media item has been deleted successfully.",
      });

      onClose();
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: "Error",
        description: "Failed to delete media item.",
        variant: "destructive",
      });
    }
  };

  if (!editItem) return null;

  return (
    <Dialog open={!!editItem} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="caption" className="text-right">
              Caption
            </Label>
            <Input
              id="caption"
              value={editItem.caption || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('caption', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product_name" className="text-right">
              Product Name
            </Label>
            <Input
              id="product_name"
              value={editItem.product_name || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('product_name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product_code" className="text-right">
              Product Code
            </Label>
            <Input
              id="product_code"
              value={editItem.product_code || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('product_code', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              value={editItem.quantity || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('quantity', parseInt(e.target.value) || null)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="vendor_uid" className="text-right">
              Vendor UID
            </Label>
            <Input
              id="vendor_uid"
              value={editItem.vendor_uid || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('vendor_uid', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="purchase_date" className="text-right">
              Purchase Date
            </Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(editItem.purchase_date) || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('purchase_date', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={editItem.notes || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
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
    </Dialog>
  );
};

export default MediaEditDialog;