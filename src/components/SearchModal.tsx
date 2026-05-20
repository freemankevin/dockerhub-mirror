import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import type { ImageRecord } from '@/types';
import { cn, getAppIcon, REGISTRY_MAP, buildPullCmd } from '@/lib/utils';

interface SearchModalProps {
  images: ImageRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: ImageRecord) => void;
}

export function SearchModal({ images, open, onOpenChange, onSelect }: SearchModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-[15vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl">
        <Command
          label="Search container images"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          loop
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search container images..."
              className="h-full w-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto p-2">
            <Command.Empty>
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/70">
                <p className="text-sm">
                  {query.trim() ? 'No results found' : 'Start typing to search...'}
                </p>
              </div>
            </Command.Empty>

            {query.trim() && (
              <Command.Group>
                {images.map((img) => {
                  const icon = getAppIcon(img.name);
                  const { path, ver } = buildPullCmd(img);
                  return (
                    <Command.Item
                      key={img.name}
                      value={`${img.name} ${img.displayName} ${img.description} ${img.source}`}
                      onSelect={() => {
                        onSelect(img);
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                        'text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground'
                      )}
                    >
                      {icon ? (
                        <img
                          src={`/logo/${icon.file}`}
                          alt={icon.alt}
                          className={cn('h-5 w-5 shrink-0 rounded object-contain', icon.invert && 'dark:invert')}
                        />
                      ) : (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                          {img.displayName?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{img.displayName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          docker pull {path}:{ver}
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {REGISTRY_MAP[img.sourceType] || img.sourceType}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground/70">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-[10px]">
                  <ArrowUp className="h-3 w-3" />
                </kbd>
                <kbd className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-[10px]">
                  <ArrowDown className="h-3 w-3" />
                </kbd>
                <span className="ml-0.5">Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-[10px]">
                  <CornerDownLeft className="h-3 w-3" />
                </kbd>
                <span className="ml-0.5">Open</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="inline-flex h-5 items-center justify-center rounded border border-border bg-background px-1.5 text-[10px]">
                esc
              </kbd>
              <span className="ml-0.5">Close</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
