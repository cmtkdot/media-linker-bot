import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MediaItem } from "@/types/media";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (dateString: string | null) => string | null;
}

const MediaEditDialog = ({ editItem, onClose, onSave, onItemChange, formatDate }: MediaEditDialogProps) => {
  if (!editItem) return null;

  return (
    <Dialog open={!!editItem} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Media Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={editItem.caption || ''}
              onChange={(e) => onItemChange('caption', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              value={editItem.product_name || ''}
              onChange={(e) => onItemChange('product_name', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="product_code">Product Code</Label>
            <Input
              id="product_code"
              value={editItem.product_code || ''}
              onChange={(e) => onItemChange('product_code', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="vendor_uid">Vendor UID</Label>
            <Input
              id="vendor_uid"
              value={editItem.vendor_uid || ''}
              onChange={(e) => onItemChange('vendor_uid', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(editItem.purchase_date || null) || ''}
              onChange={(e) => onItemChange('purchase_date', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={editItem.quantity || ''}
              onChange={(e) => onItemChange('quantity', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={editItem.notes || ''}
              onChange={(e) => onItemChange('notes', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MediaEditDialog;