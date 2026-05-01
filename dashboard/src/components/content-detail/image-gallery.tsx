"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  ImageIcon,
} from "lucide-react";
import type { MediaAsset } from "@/types/api";

interface ImageGalleryProps {
  assets: MediaAsset[];
  isGenerating?: boolean;
}

export function ImageGallery({
  assets,
  isGenerating,
}: ImageGalleryProps): React.ReactElement {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images = assets.filter((a) => a.type === "image");

  const handlePrev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % images.length);
  };

  if (isGenerating && images.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex aspect-video animate-pulse flex-col items-center justify-center gap-2 rounded-xl bg-surface-elevated"
          >
            <ImageIcon className="h-6 w-6 text-text-dim" />
            <p className="text-xs text-text-dim">Generating...</p>
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <p className="py-4 text-sm text-text-muted">No images generated yet.</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((asset, idx) => (
          <div
            key={asset.id}
            className="group relative cursor-pointer overflow-hidden rounded-xl"
            onClick={() => setLightboxIndex(idx)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={`Generated image ${idx + 1}`}
              className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
            <a
              href={asset.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2 right-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              title="Download image"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[lightboxIndex].url}
              alt={`Generated image ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain"
            />
            <p className="mt-2 text-center text-sm text-white/60">
              {lightboxIndex + 1} / {images.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
