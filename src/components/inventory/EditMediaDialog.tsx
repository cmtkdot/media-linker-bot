import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaItem } from "@/types/media";
import { MediaEditForm } from "../media/MediaEditForm";

interface EditMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem;
  onSave: (item: MediaItem) => void;
}

const EditMediaDialog = ({ open, onOpenChange, item, onSave }: EditMediaDialogProps) => {
  const handleSave = async () => {
    await onSave(item);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>
        
        <MediaEditForm 
          editItem={item}
          onItemChange={(field, value) => {
            // Handle item changes
          }}
          formatDate={(date) => {
            if (!date) return null;
            return new Date(date).toISOString().split('T')[0];
          }}
        />

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditMediaDialog;