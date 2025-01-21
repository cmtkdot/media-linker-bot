import React from "react";
import { Card } from "@/components/ui/card";

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video" | "document";
  caption?: string;
  productCode?: string;
  quantity?: number;
  createdAt: string;
}

const MediaGrid = () => {
  // Placeholder data
  const mediaItems: MediaItem[] = [
    {
      id: "1",
      url: "/placeholder.svg",
      type: "image",
      caption: "Cherry Blow Pop",
      productCode: "FISH011625",
      quantity: 3,
      createdAt: new Date().toISOString(),
    },
    // Add more placeholder items as needed
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {mediaItems.map((item) => (
        <Card key={item.id} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
          <div className="aspect-square relative">
            <img
              src={item.url}
              alt={item.caption || "Media item"}
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-4">
              <div className="text-white">
                <p className="font-medium">{item.caption}</p>
                <p className="text-sm">#{item.productCode}</p>
                <p className="text-sm">Quantity: {item.quantity}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default MediaGrid;