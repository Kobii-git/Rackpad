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
        <Route path="/devices/:id" element={<RouteFrame><DeviceDetail 