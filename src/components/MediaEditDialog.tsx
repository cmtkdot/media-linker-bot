import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaItem } from "@/types/media";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  setEditItem: (item: MediaItem | null) => void;
  onSave: () => void;
}

const MediaEditDialog = ({ editItem, setEditItem, onSave }: MediaEditDialogProps) => {
  if (!editItem) return null;

  return (
    <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
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
              onChange={(e) => setEditItem({ ...editItem, caption: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              value={editItem.product_name || ''}
              onChange={(e) => setEditItem({ ...editItem, product_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="product_code">Product Code</Label>
            <Input
              id="product_code"
              value={editItem.product_code || ''}
              onChange={(e) => setEditItem({ ...editItem, product_code: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="vendor_uid">Vendor UID</Label>
            <Input
              id="vendor_uid"
              value={editItem.vendor_uid || ''}
              onChange={(e) => setEditItem({ ...editItem, vendor_uid: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={editItem.purchase_date || ''}
              onChange={(e) => setEditItem({ ...editItem, purchase_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={editItem.quantity || ''}
              onChange={(e) => setEditItem({ ...editItem, quantity: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={editItem.notes || ''}
              onChange={(e) => setEditItem({ ...editItem, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
          <Button onClick={onSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MediaEditDialog;