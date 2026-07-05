import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import filterData from '../../data/filters.json';

const DIFFICULTY_COLORS = {
  EASY: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'bg-emerald-500/10 text-emerald-400', iconHover: 'group-hover:bg-emerald-500/20', symbol: 'code' },
  MEDIUM: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'bg-amber-500/10 text-amber-400', iconHover: 'group-hover:bg-amber-500/20', symbol: 'terminal' },
  HARD: { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: 'bg-rose-500/10 text-rose-400', iconHover: 'group-hover:bg-rose-500/20', symbol: 'memory' },
};

function ProblemCard({ problem, onOpen, companyFilter }) {
  const colors = DIFFICULTY_COLORS[problem.difficulty] || DIFFICULTY_COLORS.EASY;
  
  // 1. Safely parse companies (Handles both Arrays and Strings)
  const rawCompanies = Array.isArray(problem.companies) 
    ? problem.companies 
    : (typeof problem.companies === 'string' ? problem.companies.split(',').map(c => c.trim()) : []);
  
  const displayedCompanies = companyFilter && rawCompanies.includes(companyFilter)
    ? [companyFilter]
    : rawCompanies.slice(0, 3);
  
  const remainingCompaniesCount = rawCompanies.length - displayedCompanies.length;

  // 2. Safely parse topics (Fixing the hidden bug)
  const rawTopics = Array.isArray(problem.topic_tags)
    ? problem.topic_tags
    : (typeof problem.topic_tags === 'string' ? problem.topic_tags.split(',').map(t => t.replace(/['\[\]]/g, '').trim()) : []);
  
  const topics = rawTopics.slice(0, 2);
  const acceptance = problem.acRate ? `${parseFloat(problem.acRate).toFixed(1)}%` : '—';

  return (
    <div
      className="group bg-surface-card border border-border-subtle rounded-xl p-5 hover:border-primary/40 transition-all hover:bg-surface-container-high cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm shrink-0"
      onClick={() => onOpen(problem.id)}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className={`p-3 ${colors.icon} rounded-xl ${colors.iconHover} transition-colors shrink-0 hidden sm:block`}>
          <span className="material-symbols-outlined text-xl">{colors.symbol}</span>
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h4 className="font-semibold text-on-surface group-hover:text-primary transition-colors truncate max-w-[280px] md:max-w-md text-base leading-snug">
              {problem.title}
            </h4>
            <span className={`px-2 py-0.5 ${colors.badge} text-[10px] font-bold uppercase tracking-wider rounded-md border`}>
              {problem.difficulty || 'EASY'}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-2 text-xs text-on-surface-variant">
            {topics.map(t => (
              <span key={t} className="px-2 py-0.5 bg-surface-container-low rounded border border-border-subtle text-[11px]">
                {t}
              </span>
            ))}
            {topics.length > 0 && <span className="text-border-subtle">•</span>}
            <span>Acceptance: <span className="text-on-surface font-medium">{acceptance}</span></span>
          </div>

          {displayedCompanies.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-on-surface-variant/60 mr-0.5">business</span>
              {displayedCompanies.map((company, idx) => (
                <span key={idx} className="bg-surface-container border border-border-subtle text-on-surface-variant text-[10px] font-medium px-2 py-0.5 rounded">
                  {company}
                </span>
              ))}
              {remainingCompaniesCount > 0 && (
                <span className="text-[10px] text-primary/80 font-semibold bg-primary/10 px-1.5 py-0.5 rounded">
                  +{remainingCompaniesCount} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end shrink-0 pt-2 sm:pt-0 border-t border-border-subtle/40 sm:border-t-0">
        <button
          className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container"
          onClick={e => {
            e.stopPropagation(); 
          }}
        >
          <span className="material-symbols-outlined text-xl">bookmark</span>
        </button>
        <button 
          className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 text-xs font-bold rounded-lg hover:bg-primary hover:text-white transition-all"
        >
          Open
        </button>
      </div>
    </div>
  );
}

export default function DSAEngine() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [nextCursor, setNextCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const company = searchParams.get('company') || '';
  const topic = searchParams.get('topic') || '';
  const difficulty = searchParams.get('difficulty') || '';

  const updateParam = (key, val) => {
    const newParams = new URLSearchParams(searchParams);
    val ? newParams.set(key, val) : newParams.delete(key);
    setSearchParams(newParams);
  };

  const fetchStats = useCallback(() => {
    api.get('/api/v1/hub/stats/dsa')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const loaderRef = useRef(null);
  const fetchingRef = useRef(false);

  const fetchProblems = useCallback(async (cursor, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = { last_id: cursor, limit: 20, ...(company && { company }), ...(topic && { topic }), ...(difficulty && { difficulty }) };
      const res = await api.get('/api/v1/hub/coding', { params });
      const { items, next_cursor } = res.data;

      setProblems(prev => {
        if (reset) return items;
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...items.filter(p => !existingIds.has(p.id))];
      });
      setNextCursor(next_cursor ?? 0);
      setHasMore(items.length === 20 && next_cursor != null);
    } catch (err) {
      setError('Failed to load problems. Please try again.');
    } finally {
      setLoading(false);
      setInitialLoad(false);
      fetchingRef.current = false;
    }
  }, [company, topic, difficulty]);

  useEffect(() => {
    setProblems([]);
    setNextCursor(0);
    setHasMore(true);
    setInitialLoad(true);
    fetchProblems(0, true);
  }, [company, topic, difficulty, fetchProblems]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
        fetchProblems(nextCursor);
      }
    }, { threshold: 0.1 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, fetchProblems]);

  return (
    // 1. Lock the outermost wrapper to h-screen and prevent overflow
    <div className="bg-background-deep text-on-surface font-body-base antialiased h-screen overflow-hidden flex flex-col">
      <div className="md:pl-64 flex flex-col h-full overflow-hidden">
        
        {/* 2. Make the main workspace fill remaining space but never overflow itself (min-h-0 is crucial) */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col space-y-6 min-h-0">
          
          {/* Main Title Header (shrink-0 ensures it never gets squished) */}
          <div className="shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">Interview Hub</h2>
              <p className="text-xs text-on-surface-variant">Master technical rounds with curated roadmaps.</p>
            </div>
            
            {/* View Selector Tabs */}
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-border-subtle self-start lg:self-center gap-1">
              <button onClick={() => navigate('/interview-hub/quiz')} className="px-4 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all">Quiz</button>
              <button onClick={() => navigate('/interview-hub/qa')} className="px-4 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all">Interview Q&A</button>
              <button className="px-4 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 border border-primary/20 shadow-sm transition-all">Coding Problems</button>
            </div>
          </div>

          {/* 3. The Grid Layout - takes up the remaining height and passes it down */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            
            {/* Problems Stream View Column */}
            <div className="lg:col-span-8 flex flex-col h-full space-y-4 min-h-0">
              
              {/* Dynamic Filter Row (Fixed at the top of the column) */}
              <div className="shrink-0 bg-surface-container border border-border-subtle rounded-xl p-3 flex flex-wrap items-center gap-3">
                <select
                  value={company}
                  onChange={e => updateParam('company', e.target.value)}
                  className="flex-1 min-w-[140px] bg-surface-container-low border border-border-subtle rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 transition-all"
                >
                  <option value="">All Companies</option>
                  {filterData.companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                  value={topic}
                  onChange={e => updateParam('topic', e.target.value)}
                  className="flex-1 min-w-[140px] bg-surface-container-low border border-border-subtle rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 transition-all"
                >
                  <option value="">All Topics</option>
                  {filterData.topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <select
                  value={difficulty}
                  onChange={e => updateParam('difficulty', e.target.value)}
                  className="flex-1 min-w-[140px] bg-surface-container-low border border-border-subtle rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 transition-all"
                >
                  <option value="">All Difficulties</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              {/* 4. Problem Content Stack - THIS is the ONLY part that will scroll now */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 pb-4">
                {error && (
                  <div className="text-center py-8 text-rose-400 bg-rose-500/5 rounded-xl border border-rose-500/10 text-sm">
                    {error}
                  </div>
                )}
                
                {initialLoad && !error && (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="bg-surface-card border border-border-subtle rounded-xl p-5 animate-pulse flex gap-4">
                      <div className="w-10 h-10 bg-surface-container rounded-lg shrink-0"></div>
                      <div className="flex-1 space-y-3 py-1">
                        <div className="h-4 bg-surface-container rounded w-1/3"></div>
                        <div className="h-3 bg-surface-container rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                )}
                
                {!initialLoad && problems.length === 0 && !error && (
                  <div className="text-center py-12 text-on-surface-variant bg-surface-container-low rounded-xl border border-border-subtle border-dashed">
                    <span className="material-symbols-outlined text-4xl opacity-40 mb-2 block">search_off</span>
                    <p className="font-medium text-on-surface text-sm">No problems found matching filters.</p>
                  </div>
                )}

                {problems.map(p => (
                  <ProblemCard key={p.id} problem={p} onOpen={id => navigate(`/interview-hub/dsa/${id}`)} companyFilter={company} />
                ))}

                <div ref={loaderRef} className="flex justify-center py-4">
                  {loading && !initialLoad && (
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      Fetching entries...
                    </div>
                  )}
                  {!hasMore && problems.length > 0 && (
                    <p className="text-on-surface-variant/60 text-xs">All target nodes loaded from data graph.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics Analytics Sidebar (Also handles overflow independently if it ever gets too long) */}
            <aside className="lg:col-span-4 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-4 pr-2">
              <section className="bg-surface-container border border-border-subtle rounded-xl p-5 shadow-sm">
                {statsLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 bg-surface-container-high rounded w-1/3"></div>
                    <div className="h-8 bg-surface-container-high rounded w-1/2"></div>
                    <div className="h-2 bg-surface-container-high rounded"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Progress</p>
                        <h3 className="text-3xl font-bold tracking-tight">
                          {stats?.total_solved ?? 0}
                          <span className="text-base font-normal text-on-surface-variant">/{stats?.total_target ?? 500}</span>
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-1">Problems Solved</p>
                      </div>
                      <div className="bg-surface-container-high px-3 py-2 rounded-xl border border-border-subtle text-center min-w-[70px]">
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant/60">Streak</p>
                        <p className="text-xl font-bold text-amber-400 leading-none my-0.5">{stats?.streak ?? 0}</p>
                        <p className="text-[8px] text-amber-400/80 uppercase font-bold tracking-wider">Days</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-on-surface-variant">Overall Progress</span>
                        <span className="text-emerald-400 font-semibold">
                          {stats?.total_target ? ((stats.total_solved / stats.total_target) * 100).toFixed(1).replace(/\.0$/, '') : 0}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container-low rounded-full overflow-hidden border border-border-subtle">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-700 rounded-full"
                          style={{ width: `${stats?.total_target ? Math.min((stats.total_solved / stats.total_target) * 100, 100) : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center bg-emerald-500/5 border border-emerald-500/10 rounded-lg py-2">
                        <p className="text-emerald-400 font-bold text-lg leading-none">{stats?.easy_solved ?? 0}</p>
                        <p className="text-[9px] text-on-surface-variant uppercase font-bold mt-0.5">Easy</p>
                      </div>
                      <div className="text-center bg-amber-500/5 border border-amber-500/10 rounded-lg py-2">
                        <p className="text-amber-400 font-bold text-lg leading-none">{stats?.medium_solved ?? 0}</p>
                        <p className="text-[9px] text-on-surface-variant uppercase font-bold mt-0.5">Medium</p>
                      </div>
                      <div className="text-center bg-rose-500/5 border border-rose-500/10 rounded-lg py-2">
                        <p className="text-rose-400 font-bold text-lg leading-none">{stats?.hard_solved ?? 0}</p>
                        <p className="text-[9px] text-on-surface-variant uppercase font-bold mt-0.5">Hard</p>
                      </div>
                    </div>
                  </>
                )}
              </section>

              {/* AI Synergy Box */}
              <section className="bg-surface-container border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                <div className="bg-primary/5 p-4 flex items-center gap-3 border-b border-border-subtle">
                  <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                  <h4 className="font-semibold text-sm text-on-surface">AI Copilot Sync</h4>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-on-surface-variant/90 leading-relaxed italic border-l-2 border-primary/30 pl-3">
                    "Isolate base cases first inside recursion matrices, then track memoization space overhead profiles."
                  </p>
                  <button onClick={() => navigate('/mentor')} className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:brightness-110 transition-all shadow-sm">
                    Generate Matrix Blueprint
                  </button>
                </div>
              </section>
            </aside>
            
          </div>
        </main>
      </div>
    </div>
  );
}