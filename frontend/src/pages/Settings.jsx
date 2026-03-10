import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    businessName: user?.businessName || '',
    businessAddress: user?.businessAddress || '',
    phone: user?.phone || '',
    currency: user?.currency || 'USD',
    taxRate: user?.taxRate || 0,
    paymentTerms: user?.paymentTerms || 'Net 30',
    invoicePrefix: user?.invoicePrefix || 'INV'
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/auth/profile', data),
    onSuccess: (res) => { updateUser(res.data.user); toast.success('Settings saved!'); }
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>
      <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(form); }} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input className="input" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input bg-gray-50 cursor-not-allowed" value={user?.email} disabled />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Business Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input className="input" value={form.businessName} onChange={set('businessName')} placeholder="Your Company LLC" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
              <textarea className="input h-20 resize-none" value={form.businessAddress} onChange={set('businessAddress')} placeholder="123 Main St, City, State 12345" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input className="input" value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Invoice Defaults</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select className="input" value={form.currency} onChange={set('currency')}>
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
              <input type="number" min="0" max="100" step="0.1" className="input" value={form.taxRate} onChange={set('taxRate')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
              <input className="input" value={form.invoicePrefix} onChange={set('invoicePrefix')} placeholder="INV" />
              <p className="text-xs text-gray-400 mt-1">e.g. INV-0001</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
              <select className="input" value={form.paymentTerms} onChange={set('paymentTerms')}>
                {['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on Receipt'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}