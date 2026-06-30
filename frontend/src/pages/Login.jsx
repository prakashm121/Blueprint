import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const handleResend = async () => {
    if (!email) return;
    try {
      await api.post('/api/v1/auth/resend-verification', { email });
      setResendMsg('Verification email sent. Check your inbox.');
    } catch {
      setResendMsg('Could not resend. Try again later.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResendMsg('');
    try {
      const response = await api.post('/api/v1/auth/login', { email, password });
      const token = response.data?.access_token;
      if (!token) {
        throw new Error('No access token returned');
      }
      setAuth({ email }, token);
      const me = await api.get('/api/v1/auth/me');
      navigate(me.data.onboarding_completed ? '/dashboard' : '/onboarding', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 403) {
        setError(detail || 'Please verify your email first.');
      } else {
        setError(detail || err.message || 'Login failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="mb-8 space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-sky-400/80">Welcome back</p>
          <h1 className="text-3xl font-semibold text-white">Sign in to PlacementOS</h1>
          <p className="text-sm leading-6 text-slate-400">Continue your career planning, AI mentor sessions, and interview workflow.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-600/20 bg-red-600/10 px-4 py-3 text-sm text-red-200">
            {error}
            {error.toLowerCase().includes('verify') && (
              <button type="button" onClick={handleResend} className="mt-2 block text-sky-300 hover:text-sky-200 underline">
                Resend verification email
              </button>
            )}
          </div>
        )}
        {resendMsg && <div className="mb-4 rounded-2xl border border-sky-600/20 bg-sky-600/10 px-4 py-3 text-sm text-sky-200">{resendMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              type="email"
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400">
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New here? <Link to="/register" className="font-semibold text-slate-100 hover:text-white">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
