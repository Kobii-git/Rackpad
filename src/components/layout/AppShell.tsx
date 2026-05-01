import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { Button } from '@/components/ui/Button'
import { loadAll, useStore } from '@/lib/store'

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loading = useStore((s) => s.loading)
  const loaded = useStore((s) => s.loaded)
  const error = useStore((s) => s.error)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!loaded && !loading) {
      void loadAll()
    }
  }, [loaded, loading])

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
        <Sidebar onOpenSearch={() => setPaletteOpen(true)} />
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {!loaded ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-2)] p-6 text-center shadow-[var(--shadow-elev)]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                    Rackpad
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--color-fg)]">
                    {loading ? 'Loading infrastructure data' : 'Unable to load data'}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--color-fg-subtle)]">
                    {loading
                      ? 'Syncing racks, devices, ports, VLANs, and IPAM from the API.'
                      : error ?? 'Something went wrong while contacting the API.'}
                  </p>
                  {!loading && (
                    <div className="mt-4 flex justify-center">
                      <Button size="sm" onClick={() => void loadAll(true)}>
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </TooltipProvider>
  )
}
