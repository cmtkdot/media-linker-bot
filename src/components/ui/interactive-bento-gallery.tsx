"use client"
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react';

interface MediaItem {
  id: number;
  type: 'image' | 'video';
  title: string;
  desc: string;
  url: string;
  span: string;
}

interface InteractiveBentoGalleryProps {
  mediaItems: MediaItem[];
  title: string;
  description: string;
}

const InteractiveBentoGallery: React.FC<InteractiveBentoGalleryProps> = ({ mediaItems, title, description }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % mediaItems.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + mediaItems.length) % mediaItems.length);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div>
      <button onClick={() => setIsOpen(true)} className="btn">
        Open Gallery
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative w-full max-w-3xl p-4">
              <button onClick={handleClose} className="absolute top-2 right-2">
                <X className="h-6 w-6 text-white" />
              </button>
              <h2 className="text-white text-lg mb-2">{title}</h2>
              <p className="text-white mb-4">{description}</p>

              <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevious} className="text-white">Previous</button>
                <button onClick={handleNext} className="text-white">Next</button>
              </div>

              <div ref={galleryRef} className="overflow-hidden">
                <AnimatePresence>
                  <motion.div
                    key={mediaItems[currentIndex].id}
                    className={`flex justify-center ${mediaItems[currentIndex].span}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {mediaItems[currentIndex].type === 'video' ? (
                      <video src={mediaItems[currentIndex].url} controls className="w-full" />
                    ) : (
                      <img src={mediaItems[currentIndex].url} alt={mediaItems[currentIndex].title} className="w-full" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveBentoGallery;
