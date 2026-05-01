import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const RackViewPage = lazy(() => import('@/pages/RackViewPage'))
const DevicesList = lazy(() => import('@/pages/DevicesList'))
const DeviceDetail = lazy(() => import('@/pages/DeviceDetail'))
const PortView = lazy(() => import('@/pages/PortView'))
const CableView = lazy(() => import('@/pages/CableView'))
const VlansView = lazy(() => import('@/pages/VlansView'))
const IpamView = lazy(() => import('@/pages/IpamView'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RouteFrame><Dashboard /></RouteFrame>} />
        <Route path="/racks" element={<RouteFrame><RackViewPage /></RouteFrame>} />
        <Route path="/devices" element={<RouteFrame><DevicesList /></RouteFrame>} />
        <Route path="/devices/:id" element={<RouteFrame><DeviceDetail /></RouteFrame>} />
        <Route path="/ports" element={<RouteFrame><PortView /></RouteFrame>} />
        <Route path="/cables" element={<RouteFrame><CableView /></RouteFrame>} />
        <Route path="/vlans" element={<RouteFrame><VlansView /></RouteFrame>} />
        <Route path="/ipam" element={<RouteFrame><IpamView /></RouteFrame>} />
        <Route path="/users" element={<RouteFrame><UsersPage /></RouteFrame>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function RouteFrame({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>
}

function RouteLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-2)] p-5 text-center shadow-[var(--shadow-elev)]">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          Loading route
        </div>
        <div className="mt-2 text-sm text-[var(--color-fg-subtle)]">
          Pulling the next Rackpad workspace into view.
        </div>
      </div>
    </div>
  )
}
