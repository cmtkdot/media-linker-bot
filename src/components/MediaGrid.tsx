import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grid, List, Pencil, Play } from "lucide-react";
import MediaTable from "./MediaTable";
import MediaViewer from "./MediaViewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface MediaItem {
  id: string;
  public_url: string;
  default_public_url: string;
  file_type: string;
  caption?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  created_at: string;
}

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: mediaItems, isLoading, error } = useQuery({
    queryKey: ['telegram-media', search],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MediaItem[];
    }
  });

  const handleEdit = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          caption: editItem.caption,
          product_name: editItem.product_name,
          product_code: editItem.product_code,
          quantity: editItem.quantity,
          vendor_uid: editItem.vendor_uid,
          purchase_date: editItem.purchase_date
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "The media item has been updated successfully.",
      });

      setEditItem(null);
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: "Error",
        description: "Failed to update media item.",
        variant: "destructive",
      });
    }
  };

  const checkImageExists = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const getMediaUrl = async (item: MediaItem) => {
    if (!item.public_url) return item.default_public_url;
    const exists = await checkImageExists(item.public_url);
    return exists ? item.public_url : item.default_public_url;
  };

  const handleVideoHover = (videoElement: HTMLVideoElement) => {
    videoElement.play().catch(error => {
      console.log("Autoplay prevented:", error);
    });
  };

  const handleVideoLeave = (videoElement: HTMLVideoElement) => {
    videoElement.pause();
    videoElement.currentTime = 0;
  };

  const handlePlayClick = (e: React.MouseEvent<HTMLButtonElement>, video: HTMLVideoElement) => {
    e.stopPropagation();
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading media...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error loading media</div>;
  }

  if (!mediaItems?.length) {
    return <div className="text-center p-4">No media items found</div>;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleVideoError = (video: HTMLVideoElement, defaultUrl: string) => {
    if (video.src !== defaultUrl) {
      video.src = defaultUrl;
    }
  };

  const handleImageError = (img: HTMLImageElement, defaultUrl: string) => {
    if (img.src !== defaultUrl) {
      img.src = defaultUrl;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          className="max-w-sm"
          placeholder="Search by caption, product name, code, or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex space-x-2">
          <Button
            variant={view === 'grid' ? "default" : "outline"}
            size="icon"
            onClick={() => setView('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'table' ? "default" : "outline"}
            size="icon"
            onClick={() => setView('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaItems.map((item) => (
            <Card key={item.id} className="overflow-hidden group relative">
              <Button
                variant="outline"
                size="icon"
                className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditItem(item);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <div 
                className="aspect-square relative cursor-pointer" 
                onClick={() => setPreviewItem(item)}
              >
                {item.file_type === 'video' ? (
                  <div className="relative h-full">
                    <video 
                      src={item.public_url || item.default_public_url}
                      className="object-cover w-full h-full"
                      muted
                      playsInline
                      onMouseEnter={(e) => handleVideoHover(e.target as HTMLVideoElement)}
                      onMouseLeave={(e) => handleVideoLeave(e.target as HTMLVideoElement)}
                      onError={(e) => handleVideoError(e.target as HTMLVideoElement, item.default_public_url)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80"
                      onClick={(e) => handlePlayClick(e, e.currentTarget.parentElement?.querySelector('video') as HTMLVideoElement)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <img
                    src={item.public_url || item.default_public_url}
                    alt={item.caption || "Media item"}
                    className="object-cover w-full h-full"
                    onError={(e) => handleImageError(e.target as HTMLImageElement, item.default_public_url)}
                  />
                )}
              </div>
              <div className="p-2 text-sm space-y-1">
                <p className="font-medium truncate">{item.product_name || 'Untitled'}</p>
                <p className="text-muted-foreground capitalize">{item.file_type}</p>
                {item.quantity && (
                  <p className="text-muted-foreground">Quantity: {item.quantity}</p>
                )}
                {item.vendor_uid && (
                  <p className="text-muted-foreground">Vendor: {item.vendor_uid}</p>
                )}
                {item.purchase_date && (
                  <p className="text-muted-foreground">Purchase Date: {new Date(item.purchase_date).toLocaleDateString()}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <MediaTable data={mediaItems} onEdit={setEditItem} />
      )}

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
                value={editItem?.caption || ''}
                onChange={(e) => setEditItem(prev => prev ? {...prev, caption: e.target.value} : null)}
              />
            </div>
            <div>
              <Label htmlFor="product_name">Product Name</Label>
              <Input
                id="product_name"
                value={editItem?.product_name || ''}
                onChange={(e) => setEditItem(prev => prev ? {...prev, product_name: e.target.value} : null)}
              />
            </div>
            <div>
              <Label htmlFor="product_code">Product Code</Label>
              <Input
                id="product_code"
                value={editItem?.product_code || ''}
                onChange={(e) => setEditItem(prev => prev ? {...prev, product_code: e.target.value} : null)}
              />
            </div>
            <div>
              <Label htmlFor="vendor_uid">Vendor UID</Label>
              <Input
                id="vendor_uid"
                value={editItem?.vendor_uid || ''}
                onChange={(e) => setEditItem(prev => prev ? {...prev, vendor_uid: e.target.value} : null)}
              />
            </div>
            <div>
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formatDate(editItem?.purchase_date || null) || ''}
                onChange={(e) => setEditItem(prev => prev ? {...prev, purchase_date: e.target.value} : null)}
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={editItem?.quantity || ''}
                onChange={(e) => setEditItem(prev => prev ? {...prev, quantity: Number(e.target.value)} : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaViewer
        open={!!previewItem}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        media={previewItem}
      />
    </div>
  );
};

export default MediaGrid;
