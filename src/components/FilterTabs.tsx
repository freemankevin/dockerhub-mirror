import { cn, REGISTRY_MAP } from '@/lib/utils';
import type { RegistryFilter } from '@/types';

const FILTERS: { key: RegistryFilter; icon: string }[] = [
  { key: 'all', icon: '' },
  { key: 'dockerhub', icon: '/logo/docker.svg' },
  { key: 'github', icon: '/logo/GitHub.svg' },
  { key: 'google', icon: '/logo/google.svg' },
  { key: 'redhat', icon: '/logo/redhat.svg' },
  { key: 'aws', icon: '/logo/AWS.svg' },
];

interface FilterTabsProps {
  active: RegistryFilter;
  counts: Record<string, number>;
  onChange: (filter: RegistryFilter) => void;
}

export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {FILTERS.map(({ key, icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
            active === key
              ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {icon && (
            <img
              src={icon}
              alt={key}
              className={cn('h-3.5 w-3.5 object-contain', key === 'github' && 'dark:invert')}
            />
          )}
          <span>{REGISTRY_MAP[key] || 'All'}</span>
          <span className={cn(
            'rounded-full px-1.5 py-0 text-[10px] font-semibold',
            active === key ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {counts[key] || 0}
          </span>
        </button>
      ))}
    </nav>
  );
}
