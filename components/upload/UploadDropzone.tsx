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
          "flex min-h-72 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.025] px-6 py-12 text-center transition-all hover:border-primary/55 hover:bg-primary/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "scale-[1.01] border-primary bg-primary/8 shadow-lg",
          isUploading && "cursor-default border-primary/20 opacity-80"
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
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="absolute inset-0 animate-ping rounded-2xl border border-primary/20" />
              <Loader2 className="size-6 animate-spin" />
            </div>
            <div>
              <p className="font-semibold">Building your operations view…</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                Validating the manifest and requesting live carrier status. Large files can take a
                few minutes.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UploadCloud className="size-6" />
            </div>
            <div>
              <p className="font-semibold">Drop the daily shipment file here</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Excel and CSV files are supported
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
