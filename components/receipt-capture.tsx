"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, Upload, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReceiptUpload } from "@/hooks/useReceiptUpload";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { resolveMediaUrl } from "@/lib/media-url";

interface ReceiptCaptureProps {
  onUploadSuccess: (cid: string) => void;
  initialCid?: string;
}

export function ReceiptCapture({ onUploadSuccess, initialCid }: ReceiptCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const { upload, status, progress, error, cid, reset } = useReceiptUpload();

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    const uploadedCid = await upload(file);
    if (uploadedCid) {
      onUploadSuccess(uploadedCid);
    }
  }, [upload, onUploadSuccess]);

  const removeReceipt = useCallback(() => {
    setLocalPreview(null);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, [reset]);

  const triggerFilePicker = () => fileInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  return (
    <div className="space-y-4">
      <div className="relative group">
        {localPreview || initialCid ? (
          <div className="relative rounded-xl overflow-hidden border bg-muted aspect-[3/4] transition-all">
            <Image
              src={localPreview || resolveMediaUrl(initialCid || "")}
              alt="Receipt preview"
              fill
              className="object-contain"
            />
            
            <div className={cn(
              "absolute inset-0 flex flex-col items-center justify-center bg-black/40 transition-opacity",
              status === "success" ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            )}>
              {status === "compressing" && (
                <div className="bg-white/90 p-4 rounded-lg flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-bold text-black">Compressing...</span>
                </div>
              )}
              {status === "uploading" && (
                <div className="bg-white/90 p-4 rounded-lg flex flex-col items-center gap-2 w-40">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-black">Uploading to IPFS...</span>
                </div>
              )}
              {status === "success" && (
                <div className="bg-green-500/90 p-2 rounded-full text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              )}
              {status === "error" && (
                <div className="bg-red-500/90 p-4 rounded-lg flex flex-col items-center gap-2 text-white max-w-[80%] text-center">
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-xs font-bold">{error}</span>
                  <Button size="sm" variant="secondary" onClick={removeReceipt} className="mt-2 h-7 text-[10px]">
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={removeReceipt}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 bg-muted/20 hover:bg-muted/30 transition-all cursor-pointer min-h-[300px]"
            onClick={triggerFilePicker}
          >
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold">Snap a photo of your receipt</p>
              <p className="text-xs text-muted-foreground mt-1 px-4">
                We&apos;ll compress it and secure it on IPFS via Storacha.
              </p>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="gap-2 rounded-full"
                onClick={(e) => { e.stopPropagation(); triggerCamera(); }}
              >
                <Camera className="h-4 w-4" />
                Camera
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="gap-2 rounded-full"
                onClick={(e) => { e.stopPropagation(); triggerFilePicker(); }}
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,application/pdf"
        onChange={handleFile}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
      />
    </div>
  );
}
