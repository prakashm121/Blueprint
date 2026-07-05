import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowLeft, Award } from 'lucide-react';
import { api } from '../api';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [loading, setLoading] = useState(false);

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
    setError('');
    setLoading(true);
    
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-deep text-on-surface font-sans flex flex-col items-center justify-center relative px-6 py-12 overflow-hidden bg-grid-pattern">
      
      {/* Decorative Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary-fixed-dim/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Back button */}
      <Link
        to="/"
        className="absolute top-8 left-8 text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-surface-container-low border border-transparent hover:border-border-subtle transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      {/* Main Glass Form Container */}
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative z-10 flex flex-col items-center border border-border-subtle">
        
        {/* Brand Logo */}
        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-fixed-dim mb-4 border border-border-subtle">
          <Award className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">Blueprint</h2>
        <p className="text-xs text-on-surface-variant mb-8 mt-1 text-center">Sign in to your engineering career tracker</p>

        {/* Validation Errors & Alerts */}
        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-lg p-3 mb-4">
            {error}
            {error.toLowerCase().includes('verify') && (
              <button type="button" onClick={handleResend} className="mt-2 block text-primary-fixed-dim hover:underline font-medium cursor-pointer">
                Resend verification email
              </button>
            )}
          </div>
        )}
        {resendMsg && (
          <div className="w-full bg-surface-container border border-border-subtle text-on-surface text-xs rounded-lg p-3 mb-4">
            {resendMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant" htmlFor="email-input">
              Academic Email
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full bg-surface-container border border-border-subtle rounded-lg py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-outline transition-colors"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant" htmlFor="password-input">
                Password
              </label>
              <a href="#" className="text-[10px] text-primary-fixed-dim hover:underline font-semibold">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container border border-border-subtle rounded-lg py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-outline transition-colors"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-surface-container-highest hover:bg-surface-bright text-on-surface font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer border border-border-subtle transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative w-full my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-subtle/50"></div>
          </div>
          <span className="relative bg-surface-card px-3 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest z-10">
            or continue with
          </span>
        </div>

        {/* Custom Inline Social SSO Buttons (Zero Packages Needed) */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {/* Native GitHub Inline SVG */}
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2 border border-border-subtle bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-semibold cursor-pointer transition-colors text-on-surface"
          >
            <svg className="w-4 h-4 text-on-surface" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.008.069-.008 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </button>

          {/* Native Google Inline SVG */}
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-2 border border-border-subtle bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-semibold cursor-pointer transition-colors text-on-surface"
          >
            <svg className="w-4 h-4 text-on-surface" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Google
          </button>
        </div>

        <p className="text-xs text-on-surface-variant text-center mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-primary-fixed-dim hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}