import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Theme = 'dark' | 'light'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function smoothToggle(theme: Theme) {
  document.documentElement.classList.add('theme-switching')
  applyTheme(theme)
  // Remove the class after transitions finish
  const t = setTimeout(() => {
    document.documentElement.classList.remove('theme-switching')
  }, 250)
  return t
}

function getInitialTheme(): Theme {
  // 1. Respect stored preference
  const stored = localStorage.getItem('rackpad-theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  // 2. Fall back to OS preference
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  // 3. Default: dark (homelab default)
  return 