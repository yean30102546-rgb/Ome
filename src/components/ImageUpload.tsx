/**
 * Image Upload Component
 * Handles uploading and previewing up to 5 images per item
 */

import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageUploadProps {
  itemIndex: number;
  onImagesSelected: (files: File[]) => void;
  maxImages?: number;
}

export function ImageUpload({
  itemIndex,
  onImagesSelected,
  maxImages = 5,
}: ImageUploadProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filter: only image files
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));

    // Check max limit
    const available = maxImages - images.length;
    const filesToAdd = imageFiles.slice(0, available);

    if (filesToAdd.length > 0) {
      // Create previews
      filesToAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });

      const newImages = [...images, ...filesToAdd];
      setImages(newImages);
      onImagesSelected(newImages);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setImages(newImages);
    setPreviews(newPreviews);
    onImagesSelected(newImages);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const available = maxImages - images.length;
    const filesToAdd = imageFiles.slice(0, available);

    if (filesToAdd.length > 0) {
      filesToAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });

      const newImages = [...images, ...filesToAdd];
      setImages(newImages);
      onImagesSelected(newImages);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
          รูปภาพประกอบ (ทำให้ได้สูงสุด {maxImages} ไฟล์)
        </label>
        <span className="text-[10px] text-muted font-semibold">
          {images.length}/{maxImages}
        </span>
      </div>

      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl h-32 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer group"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload
            size={20}
            className="text-muted group-hover:text-accent mb-2 transition-colors"
          />
          <span className="text-[10px] text-muted font-bold uppercase tracking-widest">
            Drop images or click to upload
          </span>
          <span className="text-[9px] text-muted mt-1">PNG, JPG, GIF up to 10MB</span>
        </div>
      )}

      {/* Image Previews - Gallery Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          <AnimatePresence>
            {previews.map((preview, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative group"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-border">
                  <img
                    src={preview}
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty slots */}
          {images.length < maxImages &&
            [...Array(maxImages - images.length)].map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-lg border border-dashed border-border bg-slate-50 flex items-center justify-center"
              >
                <ImageIcon size={20} className="text-muted/30" />
              </div>
            ))}
        </div>
      )}

      {/* Info Message */}
      {images.length === maxImages && (
        <div className="text-[10px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          ✓ ถึงจำนวนภาพสูงสุดแล้ว
        </div>
      )}
    </div>
  );
}
