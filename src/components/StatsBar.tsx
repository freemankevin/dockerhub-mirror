import { Package, Layers, HardDrive, Cpu } from 'lucide-react';

interface StatsBarProps {
  totalImages: number;
  totalVersions: number;
  totalSize: string;
  totalPlatforms: number | string;
}

const stats = [
  { key: 'mirrors', label: 'Total Mirrors', icon: Package },
  { key: 'versions', label: 'Versions', icon: Layers },
  { key: 'size', label: 'Storage', icon: HardDrive },
  { key: 'platforms', label: 'Platforms', icon: Cpu },
] as const;

export function StatsBar({ totalImages, totalVersions, totalSize, totalPlatforms }: StatsBarProps) {
  const values: Record<string, string | number> = {
    mirrors: totalImages,
    versions: totalVersions,
    size: totalSize,
    platforms: totalPlatforms,
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ key, label, icon: Icon }) => (
        <div
          key={key}
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:shadow-md"
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/40 to-primary/10 opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="font-mono text-lg font-semibold text-foreground">{values[key]}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
