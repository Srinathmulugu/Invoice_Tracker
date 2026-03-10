import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS } from '../utils/format';
import { ArrowLeft, Edit, Send, Download, CheckCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = ['admin', 'accountant'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data.data)
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/send`),
    onSuccess: () => { queryClient.invalidateQueries(['invoice', id]); toast.success('Invoice sent!'); }
  });

  const markPaidMutation = useMutation({
    mutationFn: () => api.put(`/invoices/${id}/mark-paid`, {}),
    onSuccess: () => { queryClient.invalidateQueries(['invoice', id]); toast.success('Marked as paid!'); }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => { toast.success('Deleted'); navigate('/invoices'); }
  });

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${invoice.invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
  };

  if (isLoading) return (
    <div className="flex justify-center py-24">
      <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!invoice) return <div className="p-8 text-center text-gray-500">Invoice not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex gap-2">
          {canManage && invoice.status === 'draft' && (
            <button onClick={() => navigate(`/invoices/${id}/edit`)} className="btn-secondary flex items-center gap-2">
              <Edit size={16} /> Edit
            </button>
          )}
          <button onClick={handleDownloadPDF} className="btn-secondary flex items-center gap-2">
            <Download size={16} /> PDF
          </button>
          {canManage && (invoice.status === 'draft' || invoice.status === 'sent') && (
            <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}
              className="btn-primary flex items-center gap-2">
              <Send size={16} /> {sendMutation.isPending ? 'Sending...' : 'Send'}
            </button>
          )}
          {canManage && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button onClick={() => markPaidMutation.mutate()}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
              <CheckCircle size={16} /> Mark Paid
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {/* Header */}
        <div className="flex justify-between items-start pb-8 border-b mb-8">
          <div>
            <h1 className="text-3xl font-bold text-teal-600">{user?.businessName || user?.name}</h1>
            {user?.businessAddress && <p className="text-gray-500 mt-1 text-sm">{user.businessAddress}</p>}
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-bold text-gray-200">INVOICE</h2>
            <p className="text-xl font-bold text-gray-900 mt-2">#{invoice.invoiceNumber}</p>
            <span className={`badge ${STATUS_COLORS[invoice.status]} mt-2`}>{STATUS_LABELS[invoice.status]}</span>
            {invoice.suspicious && (
              <p className="text-sm font-semibold text-amber-600 mt-2">Suspicious Invoice</p>
            )}
          </div>
        </div>

        {/* Bill To & Dates */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{invoice.client?.name}</p>
            {invoice.client?.company && <p className="text-gray-500 text-sm">{invoice.client.company}</p>}
            <p className="text-gray-500 text-sm">{invoice.client?.email}</p>
            {invoice.client?.address?.city && (
              <p className="text-gray-500 text-sm">
                {invoice.client.address.city}, {invoice.client.address.state}
              </p>
            )}
          </div>
          <div className="text-right space-y-2">
            <div>
              <p className="text-xs text-gray-400 uppercase">Issue Date</p>
              <p className="font-medium">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Due Date</p>
              <p className={`font-medium ${invoice.status === 'overdue' ? 'text-red-600' : ''}`}>
                {formatDate(invoice.dueDate)}
              </p>
            </div>
            {invoice.paidAt && (
              <div>
                <p className="text-xs text-gray-400 uppercase">Paid On</p>
                <p className="font-medium text-green-600">{formatDate(invoice.paidAt)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-teal-600 text-white">
              <th className="text-left p-3 rounded-tl-lg text-sm">Description</th>
              <th className="text-right p-3 text-sm">Qty</th>
              <th className="text-right p-3 text-sm">Rate</th>
              <th className="text-right p-3 rounded-tr-lg text-sm">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3 text-sm text-gray-900">{item.description}</td>
                <td className="p-3 text-sm text-gray-600 text-right">{item.quantity}</td>
                <td className="p-3 text-sm text-gray-600 text-right">{formatCurrency(item.rate, invoice.currency)}</td>
                <td className="p-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.amount, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({invoice.taxRate}%)</span>
                <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
              </div>
            )}
            {invoice.discount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total</span>
              <span className="text-teal-600">{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="grid grid-cols-2 gap-6 pt-6 border-t">
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Terms</p>
                <p className="text-sm text-gray-600">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {canDelete && invoice.status === 'draft' && (
        <div className="mt-4 text-right">
          <button
            onClick={() => { if (window.confirm('Delete this invoice?')) deleteMutation.mutate(); }}
            className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 ml-auto"
          >
            <Trash2 size={14} /> Delete Invoice
          </button>
        </div>
      )}
    </div>
  );
}