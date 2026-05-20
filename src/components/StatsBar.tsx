import { Package, Layers, HardDrive, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsBarProps {
  totalImages: number;
  totalVersions: number;
  totalSize: string;
  totalPlatforms: number | string;
}

const stats = [
  {
    key: 'mirrors',
    label: 'Total Mirrors',
    icon: Package,
    gradient: 'from-blue-500/80 to-blue-400/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/10 dark:bg-blue-400/10',
  },
  {
    key: 'versions',
    label: 'Versions',
    icon: Layers,
    gradient: 'from-violet-500/80 to-violet-400/60',
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-500/10 dark:bg-violet-400/10',
  },
  {
    key: 'size',
    label: 'Storage',
    icon: HardDrive,
    gradient: 'from-emerald-500/80 to-emerald-400/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
  },
  {
    key: 'platforms',
    label: 'Platforms',
    icon: Cpu,
    gradient: 'from-amber-500/80 to-amber-400/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 dark:bg-amber-400/10',
  },
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
      {stats.map(({ key, label, icon: Icon, gradient, iconColor, iconBg }) => (
        <div
          key={key}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-border bg-card',
            'transition-all hover:border-primary/20 hover:shadow-md'
          )}
        >
          {/* Top gradient bar — mirrors MirrorCard style */}
          <div className={cn('h-[3px] w-full bg-gradient-to-r', gradient)} />

          <div className="flex items-center gap-3 px-4 py-4">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                iconBg
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', iconColor)} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl font-semibold tracking-normal text-foreground tabular-nums">
                {values[key]}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground/70">
                {label}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
