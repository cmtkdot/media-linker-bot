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
import { MediaItem } from "./types";

interface MediaEditDialogProps {
  item: MediaItem | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaEditDialog = ({ item, onClose, onSave, onChange, formatDate }: MediaEditDialogProps) => {
  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Media Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={item.caption || ''}
              onChange={(e) => onChange('caption', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              value={item.product_name || ''}
              onChange={(e) => onChange('product_name', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="product_code">Product Code</Label>
            <Input
              id="product_code"
              value={item.product_code || ''}
              onChange={(e) => onChange('product_code', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="vendor_uid">Vendor UID</Label>
            <Input
              id="vendor_uid"
              value={item.vendor_uid || ''}
              onChange={(e) => onChange('vendor_uid', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(item.purchase_date || null) || ''}
              onChange={(e) => onChange('purchase_date', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={item.quantity || ''}
              onChange={(e) => onChange('quantity', Number(e.target.value))}
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