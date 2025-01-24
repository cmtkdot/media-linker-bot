import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaItem } from "@/types/media";

interface MediaEditFormProps {
  editItem: MediaItem;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

export const MediaEditForm = ({ editItem, onItemChange, formatDate }: MediaEditFormProps) => {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="caption" className="text-right">Caption</Label>
        <Input
          id="caption"
          value={editItem.caption || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('caption', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="product_name" className="text-right">Product Name</Label>
        <Input
          id="product_name"
          value={editItem.product_name || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('product_name', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="product_code" className="text-right">Product Code</Label>
        <Input
          id="product_code"
          value={editItem.product_code || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('product_code', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="quantity" className="text-right">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          value={editItem.quantity || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('quantity', parseInt(e.target.value) || null)}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="vendor_uid" className="text-right">Vendor UID</Label>
        <Input
          id="vendor_uid"
          value={editItem.vendor_uid || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('vendor_uid', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="purchase_date" className="text-right">Purchase Date</Label>
        <Input
          id="purchase_date"
          type="date"
          value={formatDate(editItem.purchase_date) || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('purchase_date', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="notes" className="text-right">Notes</Label>
        <Input
          id="notes"
          value={editItem.notes || ''}
          className="col-span-3"
          onChange={(e) => onItemChange('notes', e.target.value)}
        />
      </div>
    </div>
  );
};