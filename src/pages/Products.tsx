import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, PlayCircle, Edit } from "lucide-react";
import { useState } from "react";
import MediaViewer from "@/components/MediaViewer";
import MediaEditDialog from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: products, refetch } = useQuery<MediaItem[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item): MediaItem => ({
        ...item,
        file_type: item.file_type as MediaItem['file_type'],
        telegram_data: item.telegram_data as Record<string, any>,
        analyzed_content: item.analyzed_content ? {
          text: typeof item.analyzed_content === 'object' && item.analyzed_content !== null 
            ? String(item.analyzed_content.text || '') 
            : '',
          labels: typeof item.analyzed_content === 'object' && item.analyzed_content !== null && 
            Array.isArray(item.analyzed_content.labels) 
            ? item.analyzed_content.labels 
            : [],
          objects: typeof item.analyzed_content === 'object' && item.analyzed_content !== null && 
            Array.isArray(item.analyzed_content.objects) 
            ? item.analyzed_content.objects 
            : []
        } : undefined,
        glide_data: item.glide_data as Record<string, any>,
        media_metadata: item.media_metadata as Record<string, any>
      }));
    }
  });

  const handleSave = async () => {
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
          purchase_date: editItem.purchase_date,
          notes: editItem.notes,
        })
        .eq('id', editItem.id);

      if (error) throw error;

      await refetch();
      toast({
        title: "Changes saved",
        description: "The media item has been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
    }
  };

  const groupMediaByProduct = (media: MediaItem[]) => {
    // First group by media_group_id or individual id
    const groups = media?.reduce<Record<string, MediaItem[]>>((acc, item) => {
      const groupId = item.telegram_data?.media_group_id || item.id;
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(item);
      return acc;
    }, {});

    // Sort items within each group (photos first)
    return Object.values(groups || {}).map(group => {
      return group.sort((a, b) => {
        if (a.file_type === 'photo' && b.file_type !== 'photo') return -1;
        if (a.file_type !== 'photo' && b.file_type === 'photo') return 1;
        return 0;
      });
    });
  };

  const handleMediaClick = (media: MediaItem, group: MediaItem[]) => {
    setSelectedMedia(media);
    setViewerOpen(true);
  };

  const handleEdit = (item: MediaItem) => {
    setEditItem(item);
  };

  const productGroups = products ? groupMediaByProduct(products) : [];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group, index) => {
          const mainProduct = group[0];
          const [currentIndex, setCurrentIndex] = useState(0);
          const hasMultipleMedia = group.length > 1;
          
          const handlePrevious = (e: React.MouseEvent) => {
            e.stopPropagation();
            setCurrentIndex((prev) => (prev > 0 ? prev - 1 : group.length - 1));
          };

          const handleNext = (e: React.MouseEvent) => {
            e.stopPropagation();
            setCurrentIndex((prev) => (prev < group.length - 1 ? prev + 1 : 0));
          };
          
          return (
            <Card key={mainProduct.id} className="overflow-hidden group">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  {group[currentIndex].file_type === 'video' ? (
                    <div 
                      className="relative w-full h-full cursor-pointer" 
                      onClick={() => handleMediaClick(group[currentIndex], group)}
                    >
                      <img
                        src={group[currentIndex].thumbnail_url || group[currentIndex].default_public_url}
                        alt={group[currentIndex].caption || ''}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <PlayCircle className="w-12 h-12 text-white opacity-75" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={group[currentIndex].public_url || group[currentIndex].default_public_url}
                      alt={group[currentIndex].caption || ''}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => handleMediaClick(group[currentIndex], group)}
                    />
                  )}

                  {hasMultipleMedia && (
                    <>
                      <button
                        onClick={handlePrevious}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={handleNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs">
                        {currentIndex + 1} / {group.length}
                      </div>
                    </>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(group[currentIndex]);
                    }}
                    className="absolute top-2 left-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl font-bold">
                  {mainProduct.product_name || "Untitled Product"}
                </CardTitle>
                {mainProduct.caption && (
                  <p className="text-lg text-muted-foreground mt-4">
                    {mainProduct.caption}
                  </p>
                )}
                {mainProduct.product_code && (
                  <p className="text-sm font-medium text-sky-500 dark:text-sky-400">
                    Product Code: {mainProduct.product_code}
                  </p>
                )}
                {mainProduct.quantity && (
                  <p className="text-sm text-muted-foreground">
                    Quantity: {mainProduct.quantity}
                  </p>
                )}
                {mainProduct.vendor_uid && (
                  <p className="text-sm text-muted-foreground">
                    Vendor: {mainProduct.vendor_uid}
                  </p>
                )}
                {mainProduct.purchase_date && (
                  <p className="text-sm text-muted-foreground">
                    Purchase Date: {format(new Date(mainProduct.purchase_date), "MM/dd/yyyy")}
                  </p>
                )}
                {mainProduct.notes && (
                  <p className="text-sm text-muted-foreground">
                    Notes: {mainProduct.notes}
                  </p>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <MediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        relatedMedia={selectedMedia ? productGroups.find(group => 
          group.some(item => item.id === selectedMedia.id)
        ) || [selectedMedia] : []}
      />

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSave}
        onItemChange={(field, value) => {
          if (editItem) {
            setEditItem({ ...editItem, [field]: value });
          }
        }}
        formatDate={(date) => {
          if (!date) return null;
          return new Date(date).toISOString().split('T')[0];
        }}
      />
    </div>
  );
};

export default Products;