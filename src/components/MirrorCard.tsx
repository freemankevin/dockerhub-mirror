import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, ChevronDown, GitBranch } from 'lucide-react';
import { cn, getAppIcon, formatSize, REGISTRY_COLORS, buildPullCmd } from '@/lib/utils';
import type { ImageRecord } from '@/types';

interface MirrorCardProps {
  image: ImageRecord;
  index: number;
}

export function MirrorCard({ image, index }: MirrorCardProps) {
  const [currentVer, setCurrentVer] = useState(image.currentVersion);
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const icon = getAppIcon(image.name);
  const isOfficial = image.official || image.name.startsWith('library/') || (image.source || '').includes('docker.io/library/') || (image.source || '').includes('public.ecr.aws/amazoncorretto');
  const { path, ver } = buildPullCmd(image);
  const cmd = `docker pull ${path}:${ver}`;

  const activeVersionObj = image.versions.find(v => (v.version || v.tag) === currentVer) || image.versions[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = cmd;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVersionChange = (version: string) => {
    setCurrentVer(version);
    setShowVersions(false);
    setDropdownPos(null);
  };

  const toggleVersions = useCallback(() => {
    if (!showVersions) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setDropdownPos({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
    }
    setShowVersions(v => !v);
  }, [showVersions]);

  useEffect(() => {
    if (!showVersions) return;

    const handleScroll = () => {
      setShowVersions(false);
      setDropdownPos(null);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [showVersions]);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/20 hover:shadow-lg animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Top gradient bar */}
      <div className={cn('h-1 w-full bg-gradient-to-r', REGISTRY_COLORS[image.sourceType] || 'from-gray-400 to-gray-500')} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {icon ? (
              <img src={`/logo/${icon.file}`} alt={icon.alt} className={cn('h-8 w-8 shrink-0 rounded-lg object-contain', icon.invert && 'dark:invert')} />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                {image.displayName?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-foreground">{image.displayName}</h3>
                {isOfficial && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </div>
              {image.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{image.description}</p>
              )}
            </div>
          </div>

          {/* Version selector */}
          <div className="relative shrink-0">
            <button
              ref={buttonRef}
              onClick={toggleVersions}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-mono font-medium text-foreground hover:bg-muted/80"
            >
              {currentVer}
              {image.versions.length > 1 && (
                <ChevronDown className={cn('h-3 w-3 transition-transform', showVersions && 'rotate-180')} />
              )}
            </button>
            {showVersions && dropdownPos && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[100]"
                  onClick={() => {
                    setShowVersions(false);
                    setDropdownPos(null);
                  }}
                />
                <div
                  className="fixed z-[110] min-w-[11rem] w-max max-w-xs overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
                  style={{ top: dropdownPos.top, right: dropdownPos.right }}
                >
                  {image.versions.map(v => {
                    const tag = v.version || v.tag || '';
                    return (
                      <button
                        key={tag}
                        onClick={() => handleVersionChange(tag)}
                        className={cn(
                          'block w-full whitespace-nowrap px-3 py-2 text-left text-xs font-mono transition-colors',
                          tag === currentVer ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body
            )}
          </div>
        </div>

        {/* Command block */}
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/5 border border-border/50 px-3 py-2.5">
          <code className="flex-1 truncate font-mono text-xs text-foreground/90">
            <span className="select-none text-muted-foreground">$</span> docker pull {path}:{ver}
          </code>
          <button
            onClick={handleCopy}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all',
              copied
                ? 'bg-green-500/10 text-green-600'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            title="Copy pull command"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between gap-2 pl-3">
          {image.source && (
            <div className="flex items-center gap-1.5 min-w-0">
              <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <p className="truncate text-[11px] text-muted-foreground/60 font-mono">{image.source}</p>
            </div>
          )}
          {activeVersionObj?.size && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatSize(activeVersionObj.size)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
