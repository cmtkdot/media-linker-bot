import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { MediaItem } from "@/types/media";

const Products = () => {
  const [products, setProducts] = useState<MediaItem[]>([]);
  const supabase = useSupabaseClient();

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
        return;
      }

      setProducts(data || []);
    };

    fetchProducts();
  }, [supabase]);

  const groupMediaByProduct = (media: MediaItem[]) => {
    const groups = media.reduce((acc, item) => {
      const key = item.product_code || "uncategorized";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, MediaItem[]>);

    return Object.values(groups);
  };

  const productGroups = groupMediaByProduct(products);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group, index) => {
          const mainProduct = group[0];
          const images = group.map(item => item.public_url || item.default_public_url).filter(Boolean) as string[];
          
          return (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-0">
                <ImageSwiper images={images} className="aspect-square" />
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
                {mainProduct.purchase_date && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Purchase Date: {format(new Date(mainProduct.purchase_date), "MM/dd/yyyy")}
                  </p>
                )}
                {mainProduct.product_code && (
                  <p className="text-sm font-medium text-sky-500 dark:text-sky-400">
                    Product Code: {mainProduct.product_code}
                  </p>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Products;