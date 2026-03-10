import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyItem = () => ({ description: '', quantity: 1, rate: 0, amount: 0 });

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    invoiceNumber: '',
    clientId: '',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    issueDate: new Date().toISOString().split('T')[0],
    taxRate: user?.taxRate || 0,
    discount: 0,
    notes: '',
    terms: user?.paymentTerms || 'Net 30',
    currency: user?.currency || 'USD',
    reminderEnabled: true,
    recurring: { enabled: false, frequency: 'monthly' },
    lineItems: [emptyItem()]
  });
  const [ocrFile, setOcrFile] = useState(null);

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then(r => r.data.data)
  });

  const { data: existingInvoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data.data),
    enabled: isEdit
  });

  useEffect(() => {
    if (existingInvoice) {
      setForm({
        invoiceNumber: existingInvoice.invoiceNumber || '',
        clientId: existingInvoice.client._id,
        dueDate: existingInvoice.dueDate.split('T')[0],
        issueDate: existingInvoice.issueDate.split('T')[0],
        taxRate: existingInvoice.taxRate,
        discount: existingInvoice.discount,
        notes: existingInvoice.notes || '',
        terms: existingInvoice.terms || '',
        currency: existingInvoice.currency,
        reminderEnabled: existingInvoice.reminderEnabled !== false,
        recurring: {
          enabled: Boolean(existingInvoice.recurring?.enabled),
          frequency: existingInvoice.recurring?.frequency || 'monthly'
        },
        lineItems: existingInvoice.lineItems
      });
    }
  }, [existingInvoice]);

  const { data: duplicateCheck, isFetching: checkingDuplicate } = useQuery({
    queryKey: ['invoice-duplicate-check', form.invoiceNumber, id],
    queryFn: () => api.get('/invoices/check-duplicate', {
      params: { invoiceNumber: form.invoiceNumber.trim(), excludeId: id }
    }).then((r) => r.data),
    enabled: Boolean(form.invoiceNumber?.trim()),
    retry: false
  });

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/invoices/${id}`, data) : api.post('/invoices', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['invoices']);
      toast.success(isEdit ? 'Invoice updated!' : 'Invoice created!');
      navigate(`/invoices/${res.data.data._id}`);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save')
  });

  const ocrMutation = useMutation({
    mutationFn: async (file) => {
      const body = new FormData();
      body.append('file', file);
      return api.post('/invoices/ocr/scan', body, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      const parsed = res.data?.data;
      setForm((f) => ({
        ...f,
        invoiceNumber: parsed?.invoiceNumber || f.invoiceNumber,
        issueDate: parsed?.date ? new Date(parsed.date).toISOString().slice(0, 10) : f.issueDate,
        notes: parsed?.gstNumber ? `${f.notes ? `${f.notes}\n` : ''}GST: ${parsed.gstNumber}` : f.notes,
        lineItems: parsed?.amount > 0
          ? [{ description: 'OCR imported amount', quantity: 1, rate: parsed.amount, amount: parsed.amount }]
          : f.lineItems
      }));
      toast.success('OCR data extracted');
    },
    onError: () => toast.error('OCR extraction failed')
  });

  const updateItem = (idx, field, value) => {
    const items = [...form.lineItems];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      items[idx].amount = items[idx].quantity * items[idx].rate;
    }
    setForm(f => ({ ...f, lineItems: items }));
  };

  const subtotal = form.lineItems.reduce((s, i) => s + (i.quantity * i.rate), 0);
  const taxAmount = (subtotal * form.taxRate) / 100;
  const total = subtotal + taxAmount - form.discount;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.clientId) return toast.error('Please select a client');
    if (duplicateCheck?.duplicate) return toast.error('Duplicate Invoice Warning: this invoice number already exists');
    saveMutation.mutate(form);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft size={16} /> Back to Invoices
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Invoice Scanner (OCR)</h2>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input type="file" accept="image/*" onChange={(e) => setOcrFile(e.target.files?.[0] || null)} className="input max-w-md" />
            <button
              type="button"
              className="btn-secondary"
              disabled={!ocrFile || ocrMutation.isPending}
              onClick={() => ocrMutation.mutate(ocrFile)}
            >
              {ocrMutation.isPending ? 'Scanning...' : 'Scan Invoice'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Extracts invoice number, date, GST and total amount from image.</p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select a client...</option>
                {clients?.map(c => <option key={c._id} value={c._id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number (optional)</label>
              <input className="input" placeholder="Auto-generated if empty" value={form.invoiceNumber}
                onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
              {form.invoiceNumber?.trim() && (
                <p className={`text-xs mt-1 ${duplicateCheck?.duplicate ? 'text-red-600' : 'text-teal-700'}`}>
                  {checkingDuplicate
                    ? 'Checking duplicate...'
                    : duplicateCheck?.duplicate
                      ? 'Duplicate Invoice Warning: this number already exists'
                      : 'Invoice number is available'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <input type="date" className="input" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Automation</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.reminderEnabled}
                onChange={e => setForm(f => ({ ...f, reminderEnabled: e.target.checked }))}
              />
              Enable auto payment reminder (3 days before due date)
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.recurring.enabled}
                onChange={e => setForm(f => ({ ...f, recurring: { ...f.recurring, enabled: e.target.checked } }))}
              />
              Make this a recurring invoice
            </label>
            {form.recurring.enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Frequency</label>
                <select className="input max-w-xs" value={form.recurring.frequency}
                  onChange={e => setForm(f => ({ ...f, recurring: { ...f.recurring, frequency: e.target.value } }))}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Line Items</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 uppercase pb-2 border-b">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>
            {form.lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5">
                  <input className="input" placeholder="Service description" value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)} required />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="0.01" className="input text-right" value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="0.01" className="input text-right" value={item.rate}
                    onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-2 text-right text-sm font-medium text-gray-900 py-2">
                  {formatCurrency(item.quantity * item.rate, form.currency)}
                </div>
                <div className="col-span-1 flex justify-end">
                  {form.lineItems.length > 1 && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))}
                      className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setForm(f => ({ ...f, lineItems: [...f.lineItems, emptyItem()] }))}
              className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium mt-2">
              <Plus size={16} /> Add Line Item
            </button>
          </div>

          <div className="mt-6 pt-4 border-t flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, form.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Tax</span>
                  <input type="number" min="0" max="100" step="0.1" className="w-16 px-2 py-1 border rounded text-xs text-right"
                    value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} />
                  <span className="text-gray-400 text-xs">%</span>
                </div>
                <span className="font-medium">{formatCurrency(taxAmount, form.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Discount</span>
                  <input type="number" min="0" step="0.01" className="w-20 px-2 py-1 border rounded text-xs text-right"
                    value={form.discount} onChange={e => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))} />
                </div>
                <span className="font-medium text-red-600">-{formatCurrency(form.discount, form.currency)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total</span>
                <span className="text-teal-600">{formatCurrency(total, form.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Notes & Terms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea className="input h-24 resize-none" placeholder="Thank you for your business!"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <textarea className="input h-24 resize-none" placeholder="Payment due within 30 days..."
                value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : (isEdit ? 'Update Invoice' : 'Create Invoice')}
          </button>
        </div>
      </form>
    </div>
  );
}