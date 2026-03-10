import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FileText, Users, Settings, LogOut, Plus } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="w-20 md:w-64 min-h-screen bg-slate-950/95 border-r border-teal-900/50 backdrop-blur-md flex flex-col">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-700/30">
            <FileText size={16} className="text-white" />
          </div>
          <span className="hidden md:block text-slate-100 font-bold text-lg">InvoiceFlow</span>
        </div>
        {user?.businessName && (
          <p className="hidden md:block text-slate-400 text-sm mt-2 truncate">{user.businessName}</p>
        )}
      </div>

      <div className="p-3 md:p-4">
        <button
          onClick={() => navigate('/invoices/new')}
          className="w-full flex items-center justify-center md:justify-start gap-2 bg-teal-600 hover:bg-teal-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus size={18} /> <span className="hidden md:inline">New Invoice</span>
        </button>
      </div>

      <nav className="flex-1 px-3 md:px-4 space-y-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-teal-700 text-white shadow-sm shadow-teal-900/60' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`
            }
          >
            <Icon size={18} /> <span className="hidden md:inline">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 md:p-4 border-t border-slate-800">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
          <div className="w-8 h-8 bg-teal-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="hidden md:block flex-1 min-w-0">
            <p className="text-slate-100 text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center justify-center md:justify-start gap-2 text-slate-400 hover:text-slate-100 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-slate-800">
          <LogOut size={16} /> <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </div>
  );
}