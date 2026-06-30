import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function CheckEmail() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || 'your inbox';

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-300 mb-6">
          <Mail className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-3">Check your email</h1>
        <p className="text-sm leading-6 text-slate-400 mb-6">
          We sent a verification link to <span className="text-slate-200">{email}</span>.
          Click the link to activate your account, then sign in.
        </p>
        <p className="text-xs text-slate-500 mb-8">
          Did not receive it? Check spam or use resend on the login page.
        </p>
        <Link
          to="/login"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}
