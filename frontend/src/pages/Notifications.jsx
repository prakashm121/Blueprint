import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ArrowLeft, Check, Inbox } from 'lucide-react';

const NOTIFICATION_TYPE_STYLES = {
  system: { bg: 'rgba(59,130,246,0.1)', text: '#38bdf8', border: 'rgba(59,130,246,0.15)' },
  planner: { bg: 'rgba(168,85,247,0.1)', text: '#c084fc', border: 'rgba(168,85,247,0.15)' },
  mentor: { bg: 'rgba(251,146,60,0.1)', text: '#fdba74', border: 'rgba(251,146,60,0.15)' },
  achievement: { bg: 'rgba(34,197,94,0.1)', text: '#4ade80', border: 'rgba(34,197,94,0.15)' },
  default: { bg: 'rgba(148,163,184,0.1)', text: '#cbd5e1', border: 'rgba(148,163,184,0.15)' }
};

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/api/v1/notifications/');
      return res.data;
    },
  });

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/api/v1/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/api/v1/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans py-12 px-6 selection:bg-sky-500/30">
      
      {/* Unified Single Center Container */}
      <div className="mx-auto max-w-2xl w-full space-y-6">
        
        {/* Simple & Minimal Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-900/60">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-900 bg-slate-900/40 text-slate-400 transition hover:border-slate-700 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Notifications</h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Updates & system activity streams
              </p>
            </div>
          </div>
          
          {notifications.some((n) => !n.read_at) && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Minimal Filtering Tabs */}
        <div className="flex gap-2">
          {['all', 'unread'].map((f) => {
            const count = f === 'unread' 
              ? notifications.filter(n => !n.read_at).length 
              : notifications.length;
            const isActive = filter === f;

            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`py-1 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="capitalize">{f}</span>
                <span className={`text-[10px] ${isActive ? 'text-sky-400/70 font-bold' : 'text-slate-600'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Notification Event Stack */}
        <div className="space-y-3 pt-1">
          {isLoading && (
            <div className="py-16 flex justify-center">
              <div className="animate-pulse text-slate-500 text-xs font-medium tracking-wide">Syncing events...</div>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-slate-900/60 bg-slate-900/20">
              <Inbox className="h-5 w-5 text-slate-700 mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No active events logged under "{filter}" filter.
              </p>
            </div>
          )}

          {!isLoading && filtered.map((n) => {
            const typeKey = n.notification_type?.toLowerCase() || 'default';
            const badgeStyle = NOTIFICATION_TYPE_STYLES[typeKey] || NOTIFICATION_TYPE_STYLES.default;
            const isUnread = !n.read_at;

            return (
              <div
                key={n.id}
                className={`group relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-150 ${
                  !isUnread
                    ? 'border-slate-900/40 bg-slate-900/10 opacity-50'
                    : 'border-slate-900 bg-slate-900/30 hover:border-slate-800'
                }`}
              >
                {/* Visual Unread Left Accent Dot */}
                {isUnread && (
                  <span className="absolute top-5.5 left-2.5 w-1 h-1 rounded-full bg-sky-400"></span>
                )}

                <div className="flex-1 min-w-0 pl-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm font-semibold tracking-tight ${isUnread ? 'text-slate-200' : 'text-slate-400'}`}>
                        {n.title}
                      </h4>
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
                        style={{ background: badgeStyle.bg, color: badgeStyle.text, borderColor: badgeStyle.border }}
                      >
                        {n.notification_type || 'system'}
                      </span>
                    </div>

                    {/* Quick Inline Mark Read Action */}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(n.id)}
                        className="shrink-0 md:opacity-0 group-hover:opacity-100 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-500 hover:border-sky-500 hover:text-sky-400 transition cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-400 leading-relaxed font-normal">
                    {n.body}
                  </p>

                  {n.action_url && (
                    <div className="mt-2">
                      <Link 
                        to={n.action_url} 
                        className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition"
                      >
                        View details →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}