import type { ImageRecord } from '@/types';
import { MirrorCard } from './MirrorCard';

interface MirrorListProps {
  images: ImageRecord[];
}

export function MirrorList({ images }: MirrorListProps) {
  if (images.length === 0) return null;
  return (
    <div className="grid gap-4">
      {images.map((img, i) => (
        <MirrorCard key={img.name} image={img} index={i} />
      ))}
    </div>
  );
}
