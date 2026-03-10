import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/common/Layout.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Clients from './pages/Clients.jsx';
import Settings from './pages/Settings.jsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
});

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to='/login' replace />;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to='/' replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path='/login' element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path='/' element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path='invoices' element={<Invoices />} />
        <Route path='invoices/new' element={<InvoiceForm />} />
        <Route path='invoices/:id' element={<InvoiceDetail />} />
        <Route path='invoices/:id/edit' element={<InvoiceForm />} />
        <Route path='clients' element={<Clients />} />
        <Route path='settings' element={<Settings />} />
      </Route>
      <Route path='*' element={<Navigate to='/' />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toaster position='top-right' toastOptions={{
            duration: 3000,
            style: { borderRadius: '12px', background: '#0f172a', color: '#ecfeff', border: '1px solid #164e63' }
          }} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}