import React from 'react';
import { Button } from "@/components/ui/button";
import { Edit, Eye, MessageCircle, ExternalLink } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaActionsProps {
  item: MediaItem;
  onEdit: () => void;
  onView: () => void;
}

const MediaActions = ({ item, onEdit, onView }: MediaActionsProps) => {
  const handleTelegramClick = () => {
    if (item.message_url) {
      window.open(item.message_url, '_blank');
    }
  };

  const handleGlideClick = () => {
    if (item.glide_app_url) {
      window.open(item.glide_app_url, '_blank');
    }
  };

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
        className="rounded-none shadow-none focus-visible:z-10"
        variant="outline"
        onClick={onView}
      >
        <Eye className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
        View
      </Button>
      <Button
        className="rounded-none shadow-none focus-visible:z-10"
        variant="outline"
        onClick={handleTelegramClick}
        disabled={!item.message_url}
      >
        <MessageCircle className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
        Telegram
      </Button>
      <Button
        className="rounded-none shadow-none last:rounded-e-lg focus-visible:z-10"
        variant="outline"
        onClick={handleGlideClick}
        disabled={!item.glide_app_url}
      >
        <ExternalLink className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
        Glide
      </Button>
    </div>
  );
};

export default MediaActions;