import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ArrowLeft, Bell, Check } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-sky-400/80">Notifications</p>
              <h1 className="text-2xl font-semibold text-white">Notification Center</h1>
            </div>
          </div>
          {notifications.some((n) => !n.read_at) && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-sm text-sky-400 hover:text-sky-300"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="mb-4 flex gap-2">
          {['all', 'unread'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-1.5 text-sm capitalize ${
                filter === f ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-slate-500 text-center py-12">Loading...</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16 rounded-3xl border border-slate-800 bg-slate-900/90">
              <Bell className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No notifications yet</p>
            </div>
          )}
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-5 transition ${
                n.read_at ? 'border-slate-800/50 bg-slate-900/50 opacity-70' : 'border-slate-800 bg-slate-900/90'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">{n.notification_type}</p>
                  <h2 className="mt-1 font-semibold text-white">{n.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{n.body}</p>
                </div>
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-sky-500 hover:text-sky-400"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
              {n.action_url && (
                <Link to={n.action_url} className="mt-3 inline-block text-sm text-sky-400 hover:text-sky-300">
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
