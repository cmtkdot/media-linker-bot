import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaItem } from '@/types/media';

interface GalleryModalProps {
  selectedItem: MediaItem;
  isOpen: boolean;
  onClose: () => void;
  setSelectedItem: (item: MediaItem | null) => void;
  mediaItems: MediaItem[];
}

const GalleryModal = ({ selectedItem, isOpen, onClose, setSelectedItem, mediaItems }: GalleryModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(mediaItems.findIndex(item => item.id === selectedItem.id));
  }, [selectedItem, mediaItems]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setSelectedItem(mediaItems[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      setSelectedItem(mediaItems[currentIndex + 1]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="relative aspect-video">
            {selectedItem.file_type === 'video' ? (
              <video
                src={selectedItem.public_url || selectedItem.default_public_url}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={selectedItem.public_url || selectedItem.default_public_url}
                alt={selectedItem.caption || ''}
                className="w-full h-full object-contain"
              />
            )}
            
            {mediaItems.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow-lg hover:bg-white disabled:opacity-50"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === mediaItems.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow-lg hover:bg-white disabled:opacity-50"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="p-4">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-2 rounded-full bg-white/90 hover:bg-white"
            >
              <X className="w-4 h-4" />
            </button>
            
            {selectedItem.caption && (
              <p className="text-sm text-gray-600 mt-2">{selectedItem.caption}</p>
            )}
          </div>

          {mediaItems.length > 1 && (
            <div className="p-4 border-t">
              <div className="flex gap-2 overflow-x-auto">
                {mediaItems.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      item.id === selectedItem.id ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    {item.file_type === 'video' ? (
                      <img
                        src={item.thumbnail_url || item.default_public_url}
                        alt={item.caption || ''}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.public_url || item.default_public_url}
                        alt={item.caption || ''}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GalleryModal;