import { Package, Layers, HardDrive, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsBarProps {
  totalImages: number;
  totalVersions: number;
  totalSize: string;
  totalPlatforms: number | string;
}

const stats = [
  { key: 'mirrors', label: 'Total Mirrors', icon: Package, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-400/10' },
  { key: 'versions', label: 'Versions', icon: Layers, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10 dark:bg-violet-400/10' },
  { key: 'size', label: 'Storage', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-400/10', icon: HardDrive },
  { key: 'platforms', label: 'Platforms', icon: Cpu, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-400/10' },
] as const;

export function StatsBar({ totalImages, totalVersions, totalSize, totalPlatforms }: StatsBarProps) {
  const values: Record<string, string | number> = {
    mirrors: totalImages,
    versions: totalVersions,
    size: totalSize,
    platforms: totalPlatforms,
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="grid grid-cols-2 divide-y divide-border/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {stats.map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className="group flex items-center gap-4 px-5 py-5 transition-colors hover:bg-muted/20 sm:px-6"
          >
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', bg)}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {values[key]}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
