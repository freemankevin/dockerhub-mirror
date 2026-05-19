import { AlertTriangle } from 'lucide-react';
import type { FailedImage } from '@/types';

interface FailedSectionProps {
  images: FailedImage[];
}

export function FailedSection({ images }: FailedSectionProps) {
  if (images.length === 0) return null;
  return (
    <section className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-red-500/20 pb-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-semibold text-foreground">Failed Syncs</h2>
        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
          {images.length}
        </span>
      </div>
      <div className="space-y-2">
        {images.map(img => (
          <div key={img.name} className="flex items-center gap-3 rounded-lg bg-background/50 px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground line-through">{img.displayName || img.name}</span>
            <span className="ml-auto text-xs text-red-400">{img.source || 'N/A'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
