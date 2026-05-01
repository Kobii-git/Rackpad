import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import RackViewPage from '@/pages/RackViewPage'
import DevicesList from '@/pages/DevicesList'
import DeviceDetail from '@/pages/DeviceDetail'
import PortView from '@/pages/PortView'
import CableView from '@/pages/CableView'
import VlansView from '@/pages/VlansView'
import IpamView from '@/pages/IpamView'
import UsersPage from '@/pages/UsersPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="/racks" element={<RackViewPage />} />
        <Route path="/devices" element={<DevicesList />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/ports" element={<PortView />} />
        <Route path="/cables" element={<CableView />} />
        <Route path="/vlans" element={<VlansView />} />
        <Route path="/ipam" element={<IpamView />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
