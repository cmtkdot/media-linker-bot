import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import MediaViewer from "./MediaViewer";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";

interface MediaTableProps {
  data: MediaItem[];
  onEdit: (item: MediaItem) => void;
}

const MediaTable = ({ data, onEdit }: MediaTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Media deleted",
        description: "The media item and associated data have been successfully deleted.",
      });

      queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: "Error",
        description: "Failed to delete media item and associated data.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const handleRowClick = (item: MediaItem) => {
    setSelectedMedia(item);
    setViewerOpen(true);
  };

  const getMediaPreview = (item: MediaItem) => {
    const previewUrl = item.thumbnail_url || item.public_url || item.default_public_url;

    if (item.file_type === 'video') {
      return (
        <div className="relative w-16 h-16">
          <img
            src={previewUrl}
            alt={getMediaCaption(item) || "Video thumbnail"}
            className="w-full h-full object-cover rounded"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.src !== item.default_public_url) {
                img.src = item.default_public_url;
              }
            }}
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[6px] border-l-black border-y-[4px] border-y-transparent ml-0.5" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <img
        src={previewUrl}
        alt={getMediaCaption(item) || "Media"}
        className="w-16 h-16 object-cover rounded"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.src !== item.default_public_url) {
            img.src = item.default_public_url;
          }
        }}
      />
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preview</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Product Code</TableHead>
              <TableHead>Vendor UID</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow 
                key={item.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(item)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {getMediaPreview(item)}
                </TableCell>
                <TableCell>{getMediaCaption(item)}</TableCell>
                <TableCell>{item.product_name || '-'}</TableCell>
                <TableCell>{item.product_code || '-'}</TableCell>
                <TableCell>{item.vendor_uid || '-'}</TableCell>
                <TableCell>{formatDate(item.purchase_date)}</TableCell>
                <TableCell>{item.quantity || '-'}</TableCell>
                <TableCell>{item.notes || '-'}</TableCell>
                <TableCell>{item.file_type}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
      />
    </>
  );
};

export default MediaTable;
