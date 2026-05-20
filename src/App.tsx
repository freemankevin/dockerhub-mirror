import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { SearchModal } from '@/components/SearchModal';
import { FilterTabs } from '@/components/FilterTabs';
import { StatsBar } from '@/components/StatsBar';
import { MirrorList } from '@/components/MirrorList';
import { FailedSection } from '@/components/FailedSection';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { BackToTop } from '@/components/BackToTop';
import { useImages } from '@/hooks/useImages';
import type { ImageRecord, RegistryFilter } from '@/types';

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    images,
    failedImages,
    counts,
    stats,
    loading,
    error,
    filter,
    setFilter,
    search,
    setSearch,
  } = useImages();

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleSearchSelect = useCallback((img: ImageRecord) => {
    setSearch(img.displayName || img.name);
    setFilter('all');
    setTimeout(() => {
      const el = document.querySelector(`[data-name="${CSS.escape(img.name)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('animate-pulse-ring');
        setTimeout(() => el.classList.remove('animate-pulse-ring'), 1500);
      }
    }, 100);
  }, [setSearch, setFilter]);

  const handleFilterChange = (f: RegistryFilter) => {
    setFilter(f);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Animated ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] h-[55vh] w-[55vw] rounded-full bg-gradient-to-br from-primary/[0.07] to-blue-400/[0.03] blur-[120px] animate-float-1 animate-breathe dark:from-primary/[0.05] dark:to-blue-400/[0.02]" />
        <div className="absolute top-[15%] -right-[5%] h-[45vh] w-[45vw] rounded-full bg-gradient-to-bl from-violet-500/[0.05] to-primary/[0.03] blur-[100px] animate-float-2 animate-breathe dark:from-violet-500/[0.04] dark:to-primary/[0.02]" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[10%] left-[15%] h-[50vh] w-[50vw] rounded-full bg-gradient-to-tr from-emerald-500/[0.04] to-primary/[0.06] blur-[110px] animate-float-3 animate-breathe dark:from-emerald-500/[0.03] dark:to-primary/[0.04]" style={{ animationDelay: '4s' }} />
      </div>

      <Header
        onSearchOpen={() => setSearchOpen(true)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />

      <SearchModal
        images={images}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleSearchSelect}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <StatsBar
          totalImages={stats.totalImages}
          totalVersions={stats.totalVersions}
          totalSize={stats.totalSize}
          totalPlatforms={stats.totalPlatforms}
        />

        {/* Filter + Search info */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs active={filter} counts={counts} onChange={handleFilterChange} />
          {search && (
            <p className="text-xs text-muted-foreground">
              Searching for "<span className="font-medium text-foreground">{search}</span>"
              <button
                onClick={() => setSearch('')}
                className="ml-2 text-primary hover:underline"
              >
                Clear
              </button>
            </p>
          )}
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <LoadingState />
          ) : error && images.length === 0 ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <p className="text-sm font-medium text-destructive">Failed to load images</p>
              <p className="mt-1 text-xs text-muted-foreground">Using cached data instead</p>
            </div>
          ) : (
            <>
              <FailedSection images={failedImages} />
              {images.length > 0 ? (
                <MirrorList images={images} />
              ) : (
                <EmptyState />
              )}
            </>
          )}
        </div>
      </main>

      <BackToTop />
    </div>
  );
}

export default App;
