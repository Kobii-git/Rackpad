import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { AuthScreen } from '@/components/shared/AuthScreen'
import { Button } from '@/components/ui/Button'
import { initializeApp, loadAll, useStore } from '@/lib/store'

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const authReady = useStore((s) => s.authReady)
  const authLoading = useStore((s) => s.authLoading)
  const currentUser = useStore((s) => 