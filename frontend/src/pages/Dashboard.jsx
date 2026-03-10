import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS } from '../utils/format';
import { Clock, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }) => (
  <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data.data)
  });

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  const monthlyData = (data?.monthlyRevenue || []).map(m => ({
    name: new Date(2024, m._id.month - 1).toLocaleString('default', { month: 'short' }),
    revenue: m.revenue
  }));

  const revenueChange = data?.lastMonthRevenue
    ? ((data.thisMonthRevenue - data.lastMonthRevenue) / data.lastMonthRevenue * 100).toFixed(1)
    : null;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-1">Here's your business overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Outstanding" value={formatCurrency(data?.totalOutstanding, user?.currency)}
          subtitle={`${(data?.statusCounts?.sent || 0) + (data?.statusCounts?.viewed || 0)} invoices pending`}
          icon={Clock} color="bg-blue-500" onClick={() => navigate('/invoices?status=sent')} />
        <StatCard title="Overdue" value={formatCurrency(data?.totalOverdue, user?.currency)}
          subtitle={`${data?.statusCounts?.overdue || 0} invoices overdue`}
          icon={AlertCircle} color="bg-red-500" onClick={() => navigate('/invoices?status=overdue')} />
        <StatCard title="Paid This Month" value={formatCurrency(data?.thisMonthRevenue, user?.currency)}
          subtitle={revenueChange ? `${revenueChange > 0 ? '+' : ''}${revenueChange}% vs last month` : ''}
          icon={CheckCircle} color="bg-green-500" />
        <StatCard title="Total Clients" value={data?.totalClients || 0} subtitle="Active clients"
          icon={FileText} color="bg-indigo-500" onClick={() => navigate('/clients')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Revenue Overview</h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v, user?.currency)} />
                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              <p>No payment data yet. Send some invoices!</p>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Invoice Status</h2>
          <div className="space-y-3">
            {Object.entries(data?.statusCounts || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                <span className="text-sm font-medium text-gray-900">{count} invoices</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
            <button onClick={() => navigate('/invoices')} className="text-sm text-indigo-600 hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {data?.recentInvoices?.length > 0 ? data.recentInvoices.map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/invoices/${inv._id}`)}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">{inv.client?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(inv.total, inv.currency)}</p>
                  <span className={`badge ${STATUS_COLORS[inv.status]}`}>{STATUS_LABELS[inv.status]}</span>
                </div>
              </div>
            )) : <p className="text-gray-400 text-sm text-center py-6">No invoices yet</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Due This Week</h2>
          <div className="space-y-3">
            {data?.upcomingDue?.length > 0 ? data.upcomingDue.map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/invoices/${inv._id}`)}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.client?.name}</p>
                  <p className="text-xs text-gray-500">{inv.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">{formatCurrency(inv.total, inv.currency)}</p>
                  <p className="text-xs text-gray-500">{formatDate(inv.dueDate)}</p>
                </div>
              </div>
            )) : <p className="text-gray-400 text-sm text-center py-6">No invoices due this week 🎉</p>}
          </div>
        </div>
      </div>
    </div>
  );
}