import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '', role: 'admin' });
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center">
              <FileText size={24} className="text-white" />
            </div>
            <span className="text-white text-2xl font-bold">InvoiceFlow</span>
          </div>
          <p className="text-gray-400">Professional invoicing for freelancers</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input className="input" required value={form.name} onChange={set('name')} placeholder="John Doe" autoComplete="name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name (optional)</label>
                  <input className="input" value={form.businessName} onChange={set('businessName')} placeholder="Acme Freelancing" autoComplete="organization" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select className="input" value={form.role} onChange={set('role')}>
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input" required value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" className="input" required minLength={6} value={form.password} onChange={set('password')} placeholder="Min 6 characters" autoComplete={isLogin ? 'current-password' : 'new-password'} />
            </div>
            <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={loading}>
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-teal-600 font-medium hover:underline">
                {isLogin ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}