import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import quizData from '../../data/quiz_filters.json';

// Visual iconography mapping lookup table for dynamic tracks
const SECTION_ICONS = {
  'AI & ML': { icon: 'psychology', desc: 'Neural networks, training optimization, and modeling vectors.' },
  'DevOps Engineer': { icon: 'terminal', desc: 'CI/CD pipeline matrices, infrastructure as code, and cloud architectures.' },
  'React Engineer': { icon: 'code', desc: 'Dynamic state synchronization, custom hooks, and layout rendering optimization.' },
  'SAP Engineer': { icon: 'layers', desc: 'Enterprise data architecture, ABAP logic, and business workflows.' },
  'Numerical Ability': { icon: 'calculate', desc: 'Mathematical reasoning, metrics verification, and strategic calculation.' },
  'Logical Reasoning': { icon: 'extension', desc: 'Pattern deduction, system matrix isolation, and sequence routing.' },
  'Verbal Ability': { icon: 'translate', desc: 'Syntactical comprehension, grammar validation, and vocabulary mapping.' }
};

export default function QuizEngine() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Filter Vectors mapped to browser address query states
  const section = searchParams.get('section') || '';
  const topic = searchParams.get('topic') || '';
  const difficulty = searchParams.get('difficulty') || '';

  // Core Evaluation Engine Machine States
  const [quizStarted, setQuizStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const timerRef = useRef(null);

  // Derive target topic array choices contextually from active section node
  const availableTopics = section && quizData.section_topics[section] 
    ? quizData.section_topics[section] 
    : Object.values(quizData.section_topics).flat();

  const updateParam = (key, val) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set(key, val);
    } else {
      newParams.delete(key);
    }
    // Automatically wipe nested child selectors if parent category updates
    if (key === 'section') newParams.delete('topic');
    setSearchParams(newParams);
  };

  // Stream targeted evaluated questions array from client-selected filters
  const startQuizSession = () => {
    setLoading(true);
    setError(null);
    
    const params = {
      limit: 15,
      ...(section && { section }),
      ...(topic && { topic }),
      ...(difficulty && { difficulty })
    };

    api.get('/api/v1/hub/quiz', { params })
      .then(res => {
        const fetchedItems = res.data?.items || res.data || [];
        if (fetchedItems.length === 0) {
          setError('No evaluation nodes matching your configured vectors were located.');
        } else {
          setQuestions(fetchedItems);
          setSelectedAnswers({});
          setCurrentIdx(0);
          setTimeLeft(fetchedItems.length * 60); // 60 seconds allocated per question node
          setQuizStarted(true);
          setQuizCompleted(false);
        }
      })
      .catch(() => setError('Failed to seed evaluation nodes. Please sync connection and retry.'))
      .finally(() => setLoading(false));
  };

  // Live Timer CountDown Hook Lifecycle Loop
  useEffect(() => {
    if (!quizStarted || quizCompleted || questions.length === 0) return;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setQuizCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [quizStarted, quizCompleted, questions]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleOptionSelect = (optionKey) => {
    if (quizCompleted) return;
    setSelectedAnswers(prev => ({ ...prev, [currentIdx]: optionKey }));
  };

  const score = questions.reduce((acc, q, idx) => {
    return selectedAnswers[idx] === q.correct_ans ? acc + 1 : acc;
  }, 0);

  return (
    <div className="bg-background-deep text-on-surface font-body-base antialiased min-h-screen">
      <div className="md:pl-64 flex flex-col min-h-screen">
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          
          {/* Module Navigation SubHeader */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">Interview Hub</h2>
              <p className="text-xs text-on-surface-variant">Calibrate operational competency profiles dynamically.</p>
            </div>
            
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-border-subtle self-start lg:self-center gap-1">
              <button className="px-4 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 border border-primary/20 shadow-sm transition-all">Quiz</button>
              <button onClick={() => navigate('/interview-hub/qa')} className="px-4 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all">Interview Q&A</button>
              <button onClick={() => navigate('/interview-hub/dsa')} className="px-4 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all">Coding Problems</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Primary Interactive Workspace */}
            <div className="lg:col-span-8 space-y-4">
              
              {error && (
                <div className="text-center py-6 text-rose-400 bg-rose-500/5 rounded-xl border border-rose-500/10 text-sm">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="bg-surface-container border border-border-subtle rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-xs text-on-surface-variant">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Initializing track profile buffers...
                </div>
              ) : !quizStarted ? (
                
                /* ================= STEP 1: CONTEXTUAL SELECTION LOBBY ================= */
                <div className="space-y-6 bg-surface-container border border-border-subtle rounded-2xl p-6 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface">Targeted Training Setup</h3>
                    <p className="text-xs text-on-surface-variant">Select your primary focus trajectory to benchmark operational precision metrics.</p>
                  </div>

                  {/* Dynamic Category Role Tracking Panels */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizData.sections.map((secName) => {
                      const isActive = section === secName;
                      const designConfig = SECTION_ICONS[secName] || { icon: 'school', desc: 'Verify specialized domain criteria matrices.' };
                      return (
                        <div
                          key={secName}
                          onClick={() => updateParam('section', isActive ? '' : secName)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all group ${
                            isActive
                              ? 'bg-primary/10 border-primary shadow-sm'
                              : 'bg-surface-container-low border-border-subtle hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant group-hover:text-primary'}`}>
                              <span className="material-symbols-outlined text-lg block">{designConfig.icon}</span>
                            </div>
                            <h4 className="font-semibold text-xs text-on-surface">{secName}</h4>
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">{designConfig.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Nested Parameter Dropdown Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Sub-Topic Filter {section && `(${section})`}
                      </label>
                      <select
                        value={topic}
                        onChange={e => updateParam('topic', e.target.value)}
                        className="w-full bg-surface-container-low border border-border-subtle rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 transition-all"
                      >
                        <option value="">{section ? 'All Topics in this Role' : 'Select a Track First'}</option>
                        {availableTopics.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Target Complexity Profile</label>
                      <select
                        value={difficulty}
                        onChange={e => updateParam('difficulty', e.target.value)}
                        className="w-full bg-surface-container-low border border-border-subtle rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 transition-all"
                      >
                        <option value="">All Thresholds</option>
                        <option value="Easy">Easy Level Core</option>
                        <option value="Medium">Medium Level Challenge</option>
                        <option value="Hard">Advanced Complexity Matrix</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={startQuizSession}
                    className="w-full py-3 bg-primary text-white text-xs font-bold rounded-xl hover:brightness-110 shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">rocket_launch</span> Initialize Evaluation Session
                  </button>
                </div>
              ) : !quizCompleted ? (
                
                /* ================= STEP 2: ACTIVE EVALUATION TRACKER ================= */
                <div className="bg-surface-container border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex justify-between items-center border-b border-border-subtle/50 pb-4">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md border border-primary/20">
                        {questions[currentIdx]?.section || 'Core Spec'}
                      </span>
                      <p className="text-xs text-on-surface-variant">Active Target Domain: <span className="text-on-surface font-medium">{questions[currentIdx]?.topic || 'General'}</span></p>
                    </div>
                    <span className="text-xs font-mono bg-surface-container-high px-2.5 py-1 border border-border-subtle rounded-lg text-on-surface-variant">
                      Node <span className="text-on-surface font-bold">{currentIdx + 1}</span> of {questions.length}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold leading-relaxed text-on-surface">
                    {questions[currentIdx]?.question}
                  </h3>

                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { key: 'A', text: questions[currentIdx]?.option_a },
                      { key: 'B', text: questions[currentIdx]?.option_b },
                      { key: 'C', text: questions[currentIdx]?.option_c },
                      { key: 'D', text: questions[currentIdx]?.option_d }
                    ].map((opt) => {
                      const isSelected = selectedAnswers[currentIdx] === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => handleOptionSelect(opt.key)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs flex items-center gap-3.5 transition-all group ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-on-surface'
                              : 'bg-surface-container-low border-border-subtle hover:border-primary/40 text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          <div className={`w-5.5 h-5.5 rounded-md font-bold flex items-center justify-center transition-colors shrink-0 text-[10px] ${
                            isSelected ? 'bg-primary text-white' : 'bg-surface-container-high border border-border-subtle'
                          }`}>
                            {opt.key}
                          </div>
                          <span className="leading-relaxed flex-1">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border-subtle/50">
                    <button
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx(prev => prev - 1)}
                      className="px-4 py-2 bg-surface-container-high border border-border-subtle text-xs font-semibold rounded-xl text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span> Back
                    </button>

                    {currentIdx < questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentIdx(prev => prev + 1)}
                        className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:brightness-110 shadow-sm transition-all flex items-center gap-1.5"
                      >
                        Next Node <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuizCompleted(true)}
                        className="px-5 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:brightness-110 shadow-sm transition-all flex items-center gap-1.5"
                      >
                        Commit Sync Results <span className="material-symbols-outlined text-sm">check_circle</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                
                /* ================= STEP 3: REVIEW METRICS INTERFACE ================= */
                <div className="bg-surface-container border border-border-subtle rounded-2xl p-6 shadow-sm text-center py-10 space-y-6">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-1">
                    <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Synchronization Finalized</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Telemetry benchmarks recorded.</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                    <div className="bg-surface-container-low border border-border-subtle p-3.5 rounded-xl">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Accuracy Matrix</p>
                      <h4 className="text-xl font-bold text-emerald-400 mt-0.5">
                        {questions.length ? Math.round((score / questions.length) * 100) : 0}%
                      </h4>
                    </div>
                    <div className="bg-surface-container-low border border-border-subtle p-3.5 rounded-xl">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Raw Yield</p>
                      <h4 className="text-xl font-bold text-on-surface mt-0.5">{score} <span className="text-xs text-on-surface-variant font-normal">/{questions.length}</span></h4>
                    </div>
                    <div className="bg-surface-container-low border border-border-subtle p-3.5 rounded-xl col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Evaluated Track</p>
                      <h4 className="text-xs font-semibold text-primary truncate mt-1.5 px-1">{section || 'Unified Profile'}</h4>
                    </div>
                  </div>

                  <button
                    onClick={() => setQuizStarted(false)}
                    className="px-5 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    Configure Another Track
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar Diagnostics Widget Deck */}
            <aside className="lg:col-span-4 space-y-4">
              <section className="bg-surface-container border border-border-subtle rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Session Clock</p>
                    <h3 className={`text-2xl font-bold font-mono tracking-tight ${quizStarted && timeLeft < 60 ? 'text-rose-400 animate-pulse' : 'text-on-surface'}`}>
                      {quizStarted ? formatTime(timeLeft) : '——'}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Time Remaining</p>
                  </div>
                  <div className="bg-surface-container-high px-3 py-1.5 rounded-xl border border-border-subtle text-center min-w-[75px]">
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant/60">Attempted</p>
                    <p className="text-lg font-bold text-emerald-400 leading-none my-0.5">{Object.keys(selectedAnswers).length}</p>
                    <p className="text-[8px] text-on-surface-variant uppercase font-bold tracking-wider">Nodes</p>
                  </div>
                </div>

                {quizStarted && questions.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-border-subtle/40">
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Pipeline Node Map</p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {questions.map((_, idx) => {
                        const isCurrent = currentIdx === idx;
                        const isAnswered = selectedAnswers[idx] !== undefined;
                        return (
                          <button
                            key={idx}
                            disabled={quizCompleted}
                            onClick={() => setCurrentIdx(idx)}
                            className={`w-6.5 h-6.5 rounded-md text-[10px] font-bold border transition-all flex items-center justify-center ${
                              isCurrent
                                ? 'bg-primary border-primary text-white shadow-sm'
                                : isAnswered
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-surface-container-low border-border-subtle text-on-surface-variant'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </aside>
            
          </div>
        </main>
      </div>
    </div>
  );
}