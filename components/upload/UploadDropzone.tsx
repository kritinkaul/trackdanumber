"use client";

import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export function UploadDropzone({ onFileSelected, isUploading }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        setRejected(`"${file.name}" is not a supported file. Upload a .xlsx or .csv file.`);
        return;
      }
      setRejected(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload shipment spreadsheet"
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isUploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isUploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!isUploading) handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 text-center transition-colors",
          isDragging && "border-primary bg-primary/5",
          isUploading && "cursor-default opacity-70"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {isUploading ? (
          <>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">Processing shipments…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Reading the spreadsheet and fetching live FedEx status for every tracking number.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <UploadCloud className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Drop your daily shipment file here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to browse — .xlsx and .csv are supported
              </p>
            </div>
            <Button variant="outline" size="sm" className="pointer-events-none mt-1">
              <FileSpreadsheet className="size-4" />
              Choose file
            </Button>
          </>
        )}
      </div>
      {rejected && <p className="text-sm text-red-600">{rejected}</p>}
    </div>
  );
}
