import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }
    api.get('/api/v1/auth/verify', { params: { token } })
      .then((res) => {
        setStatus('success');
        setMessage(res.data?.message || 'Email verified successfully.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification failed.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-sky-400 mx-auto mb-4" />
            <p className="text-slate-400">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-white mb-3">Email verified</h1>
            <p className="text-sm text-slate-400 mb-8">{message}</p>
            <Link to="/login" className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-400">
              Sign in
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-white mb-3">Verification failed</h1>
            <p className="text-sm text-slate-400 mb-8">{message}</p>
            <Link to="/login" className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 px-4 py-3 font-semibold text-slate-300 hover:border-slate-500">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
