import React from 'react';
import { Button } from "@/components/ui/button";
import { Edit, Eye } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaActionsProps {
  item: MediaItem;
  onEdit: () => void;
  onView: () => void;
}

const MediaActions = ({ item, onEdit, onView }: MediaActionsProps) => {
  return (
    <div className="inline-flex -space-x-px rounded-lg shadow-sm shadow-black/5 rtl:space-x-reverse">
      <Button
        className="rounded-none shadow-none first:rounded-s-lg focus-visible:z-10"
        variant="outline"
        onClick={onEdit}
      >
        <Edit className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
        Edit
      </Button>
      <Button
        className="rounded-none shadow-none last:rounded-e-lg focus-visible:z-10"
        variant="outline"
        onClick={onView}
      >
        <Eye className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
        View
      </Button>
    </div>
  );
};

export default MediaActions;