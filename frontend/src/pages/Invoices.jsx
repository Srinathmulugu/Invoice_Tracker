import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS } from '../utils/format';
import { Plus, Search, Download, Send, CheckCircle, Trash2, Copy, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['all', 'draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'];

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const status = searchParams.get('status') || 'all';
  const [page, setPage] = useState(1);
  const canManage = ['admin', 'accountant'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', status, page, search, dateFrom, dateTo, minAmount, maxAmount, clientFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        status: status !== 'all' ? status : undefined,
        page,
        limit: 10,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        minAmount: minAmount || undefined,
        maxAmount: maxAmount || undefined,
        client: clientFilter || undefined
      }
    }).then(r => r.data)
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-all-for-filters'],
    queryFn: () => api.get('/clients', { params: { limit: 200 } }).then((r) => r.data.data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/invoices/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['invoices']); toast.success('Invoice deleted'); }
  });

  const sendMutation = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/send`),
    onSuccess: () => { queryClient.invalidateQueries(['invoices']); toast.success('Invoice sent!'); }
  });

  const markPaidMutation = useMutation({
    mutationFn: (id) => api.put(`/invoices/${id}/mark-paid`, {}),
    onSuccess: () => { queryClient.invalidateQueries(['invoices', 'dashboard']); toast.success('Marked as paid!'); }
  });

  const duplicateMutation = useMutation({
    mutationFn: (id) => api.post(`/invoices/${id}/duplicate`),
    onSuccess: (res) => { queryClient.invalidateQueries(['invoices']); navigate(`/invoices/${res.data.data._id}/edit`); }
  });

  const handleDownloadPDF = async (id, invoiceNumber) => {
    try {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  };

  const exportFile = async (type) => {
    try {
      const response = await api.get(`/invoices/export/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices.${type === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${type.toUpperCase()} successfully`);
    } catch {
      toast.error(`Failed to export ${type.toUpperCase()}`);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => exportFile('csv')} className="btn-secondary text-sm" disabled={!canManage}>Export CSV</button>
          <button onClick={() => exportFile('excel')} className="btn-secondary text-sm" disabled={!canManage}>Export Excel</button>
          <button onClick={() => navigate('/invoices/new')} className="btn-primary flex items-center gap-2" disabled={!canManage}>
            <Plus size={18} /> New Invoice
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search invoice or client..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <button key={s}
                onClick={() => { setSearchParams(s !== 'all' ? { status: s } : {}); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  status === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          <select className="input" value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }}>
            <option value="">All clients</option>
            {clients?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          <input type="number" className="input" placeholder="Min amount" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1); }} />
          <div className="flex gap-2">
            <input type="number" className="input" placeholder="Max amount" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1); }} />
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              onClick={() => {
                setSearch('');
                setDateFrom('');
                setDateTo('');
                setMinAmount('');
                setMaxAmount('');
                setClientFilter('');
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-teal-600 border-t-transparent rounded-full" /></div>
        ) : data?.data?.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No invoices found</p>
            <button onClick={() => navigate('/invoices/new')} className="btn-primary">Create your first invoice</button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Invoice', 'Client', 'Date', 'Due Date', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data?.map(invoice => (
                <tr key={invoice._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <button onClick={() => navigate(`/invoices/${invoice._id}`)}
                      className="font-medium text-teal-600 hover:underline">{invoice.invoiceNumber}</button>
                    {invoice.suspicious && (
                      <p className="text-xs font-semibold text-amber-600 mt-1">Suspicious Invoice</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{invoice.client?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(invoice.issueDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(invoice.dueDate)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(invoice.total, invoice.currency)}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${STATUS_COLORS[invoice.status]}`}>{STATUS_LABELS[invoice.status]}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/invoices/${invoice._id}`)} className="text-gray-400 hover:text-teal-600"><Eye size={16} /></button>
                      <button onClick={() => handleDownloadPDF(invoice._id, invoice.invoiceNumber)} className="text-gray-400 hover:text-teal-600"><Download size={16} /></button>
                      {canManage && (invoice.status === 'draft' || invoice.status === 'sent') && (
                        <button onClick={() => sendMutation.mutate(invoice._id)} className="text-gray-400 hover:text-blue-600"><Send size={16} /></button>
                      )}
                      {canManage && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                        <button onClick={() => markPaidMutation.mutate(invoice._id)} className="text-gray-400 hover:text-green-600"><CheckCircle size={16} /></button>
                      )}
                      {canManage && <button onClick={() => duplicateMutation.mutate(invoice._id)} className="text-gray-400 hover:text-gray-600"><Copy size={16} /></button>}
                      {canDelete && invoice.status === 'draft' && (
                        <button onClick={() => { if(window.confirm('Delete?')) deleteMutation.mutate(invoice._id); }}
                          className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.pages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            {Array.from({ length: data.pages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}