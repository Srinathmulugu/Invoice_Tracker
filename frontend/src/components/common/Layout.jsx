import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar />
      <main className="relative flex-1 overflow-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 right-8 h-72 w-72 rounded-full bg-teal-200/25 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-64 w-64 rounded-full bg-emerald-200/20 blur-3xl" />
        </div>
        <div className="relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}