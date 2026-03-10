import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import { Plus, Search, Trash2, Mail, Phone, Building } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Clients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '',
    address: { street: '', city: '', state: '', zipCode: '', country: '' }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => api.get('/clients', { params: { page, limit: 12, search: search || undefined } }).then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
      toast.success('Client added!');
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', company: '', address: { street: '', city: '', state: '', zipCode: '', country: '' } });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/clients/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['clients']); toast.success('Client deleted'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Cannot delete')
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Client
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Add New Client</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">City / State / ZIP</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input" placeholder="City" value={form.address.city} onChange={e => setForm(f => ({ ...f, address: { ...f.address, city: e.target.value } }))} />
                    <input className="input" placeholder="State" value={form.address.state} onChange={e => setForm(f => ({ ...f, address: { ...f.address, state: e.target.value } }))} />
                    <input className="input" placeholder="ZIP" value={form.address.zipCode} onChange={e => setForm(f => ({ ...f, address: { ...f.address, zipCode: e.target.value } }))} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="relative mb-6 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search clients..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : data?.data?.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 mb-4">No clients yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Add your first client</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.map(client => (
            <div key={client._id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                    {client.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    {client.company && <p className="text-sm text-gray-500 flex items-center gap-1"><Building size={12} />{client.company}</p>}
                  </div>
                </div>
                <button onClick={() => { if(window.confirm(`Delete ${client.name}?`)) deleteMutation.mutate(client._id); }}
                  className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
              <div className="space-y-1 text-sm text-gray-500 mb-4">
                <p className="flex items-center gap-2"><Mail size={13} />{client.email}</p>
                {client.phone && <p className="flex items-center gap-2"><Phone size={13} />{client.phone}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div><p className="text-xs text-gray-400">Invoiced</p><p className="text-sm font-medium">{formatCurrency(client.totalInvoiced)}</p></div>
                <div><p className="text-xs text-gray-400">Paid</p><p className="text-sm font-medium text-green-600">{formatCurrency(client.totalPaid)}</p></div>
              </div>
              <button onClick={() => navigate('/invoices/new')} className="w-full mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                + New Invoice
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}