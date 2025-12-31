import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  Plus, 
  Camera, 
  RefreshCw, 
  ChevronLeft, 
  CheckCircle2, 
  Circle, 
  Settings, 
  StickyNote, 
  X, 
  Edit2, 
  Briefcase, 
  ChevronDown, 
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { Routes, Route, useNavigate, useParams, Link, useLocation } from 'react-router-dom';

const POST_STATUS_OPTIONS = ["未編集", "編集中", "FIX", "投稿済み"];

const App = () => {
  // アプリグローバルstate
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [creators, setCreators] = useState([]);
  const [alertMessage, setAlertMessage] = useState(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [personModalType, setPersonModalType] = useState('creator'); // 'creator' | 'director'
  const [editingPerson, setEditingPerson] = useState(null);
  const [showPreShootTasks, setShowPreShootTasks] = useState(true);
  const [nextShootCount, setNextShootCount] = useState('');
  const [nextShootDate, setNextShootDate] = useState('');
  const [nextShootSaveState, setNextShootSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const navigate = useNavigate();
  const location = useLocation();

  // ヘッダーメニューの「動き」（JSでアクティブインジケーターをスライド）
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  // ページ判定
  const isDashboard = location.pathname === '/dashboard';
  // extract :id from /project/:id
  const projectId = location.pathname.startsWith('/project/') ? location.pathname.split('/project/')[1] : null;

  // 案件ID選択時のプロジェクト取得
  const currentProject = useMemo(() =>
    projects.find(p => p.id === projectId), [projectId, projects]
  );

  // 通知自動消去
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  // --- 操作ハンドラー ---
  const handleAddTask = async (category, title, indexLabel = '') => {
    const insertData = {
      project_id: projectId,
      category,
      index_label: indexLabel || (category === 'OP_EXEC' ? 'NEW' : ''),
      title,
      status: category === 'OP_EXEC' ? '未編集' : 'TODO',
      due_date: '',
      assignee: currentProject?.director || ''
    };
    const {error} = await supabase.from('tasks').insert([insertData]);
    if (!error) {
      const { data: tasksData } = await supabase.from('tasks').select('*');
      setTasks(tasksData || []);
    } else {
      setAlertMessage('タスク追加に失敗しました');
    }
  };

  const updateTask = async (taskId, fields) => {
    const { error } = await supabase.from('tasks').update(fields).eq('id', taskId);
    if (!error) {
      const { data: tasksData } = await supabase.from('tasks').select('*');
      setTasks(tasksData || []);
    } else {
      setAlertMessage('タスクの更新に失敗しました');
    }
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (!error) {
      const { data: tasksData } = await supabase.from('tasks').select('*');
      setTasks(tasksData || []);
    } else {
      setAlertMessage('タスクの削除に失敗しました');
    }
  };

  useEffect(() => {
    // プロジェクト切り替え/データ再取得時に入力UIを同期（タスクではなく案件情報として保持）
    setNextShootCount(currentProject?.next_shoot_count || '');
    setNextShootDate(currentProject?.next_shoot_date || '');
    setNextShootSaveState('idle');
  }, [currentProject?.id, currentProject?.next_shoot_count, currentProject?.next_shoot_date]);

  const persistNextShoot = async (fields) => {
    if (!projectId) return;
    setNextShootSaveState('saving');

    // 楽観的更新（UI即反映）
    setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, ...fields } : p)));

    const { error } = await supabase.from('projects').update(fields).eq('id', projectId);
    if (!error) {
      const { data: projectsData } = await supabase.from('projects').select('*');
      setProjects(projectsData || []);
      setNextShootSaveState('saved');
      // すぐ消えるように
      setTimeout(() => setNextShootSaveState('idle'), 1200);
    } else {
      setNextShootSaveState('error');
      setAlertMessage('次回撮影情報の保存に失敗しました（projects側のカラムを確認してください）');
    }
  };

  // 自動保存（入力後に少し待ってから保存）
  useEffect(() => {
    if (!projectId) return;
    // currentProjectがまだ取れていない初期は走らせない
    if (!currentProject) return;

    const nextCount = nextShootCount || '';
    const nextDate = nextShootDate || '';
    const curCount = currentProject.next_shoot_count || '';
    const curDate = currentProject.next_shoot_date || '';
    if (nextCount === curCount && nextDate === curDate) return;

    const t = setTimeout(() => {
      persistNextShoot({
        next_shoot_count: nextCount,
        next_shoot_date: nextDate
      });
    }, 600);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, nextShootCount, nextShootDate]);

  // メンバー削除
  const handleDeletePerson = async (id, name, type) => {
    const assignedProjects = projects.filter(p => 
      type === 'creator' ? p.assigned_creator === name : p.director === name);
    if (assignedProjects.length > 0) {
      const projectNames = assignedProjects.map(p => p.client).join('、');
      setAlertMessage(`${name}さんは案件（${projectNames}）にアサインされているため削除できません。`);
      return;
    }
    if (type === 'creator') {
      const { error } = await supabase.from('creators').delete().eq('id', id);
      if (!error) {
        const { data: creatorsData } = await supabase.from('creators').select('*');
        setCreators(creatorsData || []);
      } else {
        setAlertMessage('クリエイター削除に失敗しました');
      }
    } else {
      const { error } = await supabase.from('directors').delete().eq('id', id);
      if (!error) {
        const { data: directorsData } = await supabase.from('directors').select('*');
        setDirectors(directorsData || []);
      } else {
        setAlertMessage('ディレクター削除に失敗しました');
      }
    }
  };

  // 案件保存
  const saveProject = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      director: fd.get('director'),
      assigned_creator: fd.get('assigned_creator'),
      contract_month: fd.get('contract_month'),
      start_month: fd.get('start_month'),
      expiry_month: fd.get('expiry_month'),
      memo: fd.get('memo')
    };
    let error;
    if (editingProject) {
      ({ error } = await supabase.from('projects').update(data).eq('id', editingProject.id));
    } else {
      ({ error } = await supabase.from('projects').insert([data]));
    }
    if (!error) {
      const { data: projectsData } = await supabase.from('projects').select('*');
      setProjects(projectsData || []);
      setIsProjectModalOpen(false);
      navigate('/dashboard');
    } else {
      setAlertMessage('案件保存に失敗しました');
    }
  };

  // メンバー保存
  const savePerson = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const personData = {
      name: formData.get('name'),
      email: formData.get('email'),
      note: formData.get('note')
    };
    let error;
    if (personModalType === 'creator') {
      if (editingPerson) {
        ({ error } = await supabase.from('creators').update(personData).eq('id', editingPerson.id));
      } else {
        ({ error } = await supabase.from('creators').insert([personData]));
      }
      if (!error) {
        const { data: creatorsData } = await supabase.from('creators').select('*');
        setCreators(creatorsData || []);
      }
    } else {
      if (editingPerson) {
        ({ error } = await supabase.from('directors').update(personData).eq('id', editingPerson.id));
      } else {
        ({ error } = await supabase.from('directors').insert([personData]));
      }
      if (!error) {
        const { data: directorsData } = await supabase.from('directors').select('*');
        setDirectors(directorsData || []);
      }
    }
    if (!error) {
      setIsPersonModalOpen(false);
      setEditingPerson(null);
    } else {
      setAlertMessage('メンバー保存に失敗しました');
    }
  };

  // --- カスタムUIコンポーネント ---
  const CustomSelect = ({ value, onChange, options, className = "" }) => (
    <div className="relative w-full">
      <select 
        value={value} 
        onChange={onChange}
        className={`appearance-none w-full bg-white border-2 border-black px-2 py-1 text-[10px] font-black outline-none cursor-pointer hover:bg-slate-50 transition-colors pr-6 ${className}`}
      >
        {options}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-black">
        <ChevronDown size={12} />
      </div>
    </div>
  );

  // タスクテーブル
  const TaskTable = ({ category, title, icon: Icon, colorClass, isFull = false, headerRight = null }) => {
    const filteredTasks = tasks.filter(t => t.project_id === projectId && t.category === category);
    const isSchedule = category === 'OP_EXEC';
    const [inputValue, setInputValue] = useState('');
    const [inputIndex, setInputIndex] = useState('');
    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing && inputValue.trim()) {
        handleAddTask(category, inputValue, inputIndex);
        setInputValue('');
        setInputIndex('');
      }
    };
    return (
      <div className={`border-4 border-black bg-white mb-6 flex flex-col ${!isFull ? 'flex-1' : 'w-full'}`}>
        <div className={`px-4 py-2 border-b-4 border-black flex items-center justify-between ${colorClass} font-black text-black`}>
          <div className="flex items-center gap-2">
            <Icon size={18} />
            <span className="uppercase tracking-widest text-xs">{title}</span>
          </div>
          {headerRight ? <div className="ml-3 flex items-center justify-end">{headerRight}</div> : null}
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-black text-[9px] font-black uppercase tracking-tighter text-slate-400">
              <th className="w-12 p-2 text-center border-r-2 border-black">#</th>
              <th className="p-2 border-r-2 border-black">{isSchedule ? "動画タイトル" : "内容 / 備考"}</th>
              <th className="w-28 p-2 border-r-2 border-black text-center">状態</th>
              <th className="w-28 p-2 text-center">期日/投稿予定</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => (
              <tr key={task.id} className="border-b-2 border-black group hover:bg-[#FFE900]/10 transition-colors">
                <td className="p-2 text-center border-r-2 border-black font-black italic text-xs text-black">
                  {isSchedule ? (
                    <input 
                      className="w-full bg-transparent text-center outline-none"
                      value={task.index_label}
                      onChange={e => updateTask(task.id, { index_label: e.target.value })}
                    />
                  ) : (
                    <button onClick={() => updateTask(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' })}>
                      {task.status === 'DONE' ? <CheckCircle2 className="text-[#004097]" size={18} /> : <Circle className="text-slate-300" size={18} />}
                    </button>
                  )}
                </td>
                <td className="p-2 border-r-2 border-black text-black">
                  <input 
                    className={`w-full bg-transparent outline-none font-bold text-xs ${task.status === 'DONE' ? 'line-through text-slate-300 font-normal' : ''}`}
                    value={task.title}
                    onChange={e => updateTask(task.id, { title: e.target.value })}
                    placeholder={isSchedule ? "動画タイトルを入力..." : "項目名..."}
                  />
                </td>
                <td className="p-1 border-r-2 border-black text-black text-center">
                  {isSchedule ? (
                    <CustomSelect 
                      value={task.status}
                      onChange={e => updateTask(task.id, { status: e.target.value })}
                      options={POST_STATUS_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                    />
                  ) : (
                    <button 
                      onClick={() => updateTask(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' })}
                      className={`w-full py-0.5 border-2 border-black text-[9px] font-black uppercase ${task.status === 'DONE' ? 'bg-[#004097] text-white' : 'bg-white text-black'}`}
                    >
                      {task.status === 'DONE' ? '完了済' : '未完了'}
                    </button>
                  )}
                </td>
                <td className="p-1 text-black">
                  <input 
                    type="date" 
                    className="w-full bg-white border-2 border-black px-1 py-0.5 text-[9px] font-black outline-none"
                    value={task.due_date || ''}
                    onChange={e => updateTask(task.id, { due_date: e.target.value })}
                  />
                </td>
                <td className="p-1 text-center">
                  <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100">
              <td className="p-2 border-r-2 border-black text-center font-black italic text-black">
                {isSchedule ? (
                   <input className="w-full bg-transparent text-center text-xs font-black outline-none italic" placeholder="#" value={inputIndex} onChange={e => setInputIndex(e.target.value)} />
                ) : <Plus size={14} className="mx-auto text-slate-400" />}
              </td>
              <td colSpan={4} className="p-0">
                <input 
                  className="w-full bg-transparent px-3 py-2 text-xs font-bold outline-none placeholder:italic text-black"
                  placeholder={isSchedule ? "新しい動画タイトルを追加してEnter..." : "新しい項目を追加してEnter..."}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // --- データベースからのフェッチ（最初） ---
  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: projectsData }, { data: tasksData }, { data: directorsData }, { data: creatorsData }] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('directors').select('*'),
        supabase.from('creators').select('*')
      ]);
      setProjects(projectsData || []);
      setTasks(tasksData || []);
      setDirectors(directorsData || []);
      setCreators(creatorsData || []);
    };
    fetchAll();
  }, []);

  // ---------------- Render 部分 -----------------
  const DirectoryRoute = () => {
    const { type } = useParams();
    const normalizedType = type === 'creator' ? 'creator' : 'director';
    return (
      <DirectoryView
        creators={creators}
        directors={directors}
        personType={normalizedType}
        setPersonModalType={setPersonModalType}
        setEditingPerson={setEditingPerson}
        setIsPersonModalOpen={setIsPersonModalOpen}
        handleDeletePerson={handleDeletePerson}
      />
    );
  };

  const activeNavKey = useMemo(() => {
    if (location.pathname === '/dashboard') return 'dashboard';
    if (location.pathname === '/directory/creator') return 'creator';
    if (location.pathname === '/directory/director') return 'director';
    return null;
  }, [location.pathname]);

  const updateNavIndicator = () => {
    const navEl = navRef.current;
    const key = activeNavKey;
    if (!navEl || !key) {
      setNavIndicator(prev => ({ ...prev, opacity: 0 }));
      return;
    }
    const tabEl = tabRefs.current[key];
    if (!tabEl) {
      setNavIndicator(prev => ({ ...prev, opacity: 0 }));
      return;
    }
    const navRect = navEl.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();
    setNavIndicator({
      left: Math.round(tabRect.left - navRect.left),
      width: Math.round(tabRect.width),
      opacity: 1
    });
  };

  useLayoutEffect(() => {
    updateNavIndicator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNavKey]);

  useEffect(() => {
    const onResize = () => updateNavIndicator();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNavKey]);

  return (
    <>
      {/* エラー通知バー */}
      {alertMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg animate-in slide-in-from-top-10 duration-300">
          <div className="bg-[#FFE900] border-4 border-black p-4 shadow-[8px_8px_0px_#000] flex items-center gap-4 font-black text-xs">
            <AlertTriangle className="flex-shrink-0" size={20} />
            <p>{alertMessage}</p>
            <button onClick={() => setAlertMessage(null)} className="ml-auto hover:rotate-90 transition-transform"><X size={20} /></button>
          </div>
        </div>
      )}
      <header className="border-b-4 border-black sticky top-0 z-40 bg-white px-6 h-14 flex items-center justify-between text-black">
        <div className="flex items-center gap-8 h-full">
          <Link className="font-black italic text-2xl tracking-tighter cursor-pointer" to="/">GIVEE.</Link>
          <nav ref={navRef} className="relative flex h-full border-l-4 border-black text-black">
            {/* JSで動くアクティブインジケーター */}
            <span
              aria-hidden="true"
              className="absolute bottom-0 h-[4px] bg-black transition-[left,width,opacity] duration-300 ease-out"
              style={{ left: navIndicator.left, width: navIndicator.width, opacity: navIndicator.opacity }}
            />

            <Link
              ref={(el) => { tabRefs.current.dashboard = el; }}
              to="/dashboard"
              className={`px-6 text-xs md:text-sm font-black tracking-widest h-full transition-all duration-200 flex items-center ${isDashboard ? 'bg-[#FFE900]' : 'hover:bg-slate-50'} hover:-translate-y-[1px]`}
            >
              案件一覧
            </Link>
            <Link
              ref={(el) => { tabRefs.current.creator = el; }}
              to="/directory/creator"
              className={`px-6 text-xs md:text-sm font-black tracking-widest h-full border-l-4 border-black transition-all duration-200 flex items-center ${location.pathname === '/directory/creator' ? 'bg-[#FFE900]' : 'hover:bg-slate-50'} hover:-translate-y-[1px]`}
            >
              クリエイター
            </Link>
            <Link
              ref={(el) => { tabRefs.current.director = el; }}
              to="/directory/director"
              className={`px-6 text-xs md:text-sm font-black tracking-widest h-full border-l-4 border-black transition-all duration-200 flex items-center ${location.pathname === '/directory/director' ? 'bg-[#FFE900]' : 'hover:bg-slate-50'} hover:-translate-y-[1px]`}
            >
              ディレクター
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-black">
          <Link to="/" className="text-slate-400 hover:text-black transition-colors font-bold text-[10px] uppercase tracking-widest border-r-2 border-black pr-4 mr-2">ホーム</Link>
          <p className="text-[11px] font-black uppercase tracking-tight">Givee メンバー</p>
        </div>
      </header>
      <Routes>
        {/* HOME 画面 */}
        <Route path="/" element={
          <div className="min-h-screen bg-[#FFE900] flex items-center justify-center p-6 text-black font-sans overflow-hidden">
            <div className="bg-white border-[6px] border-black p-12 md:p-20 max-w-2xl w-full relative shadow-[24px_24px_0px_rgba(0,0,0,1)] text-center animate-in zoom-in-95 duration-500">
              <div className="relative z-10 text-black">
                <div className="w-20 h-20 bg-black flex items-center justify-center mb-10 mx-auto transform -rotate-6 text-[#FFE900] shadow-lg"><Briefcase size={40} /></div>
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter leading-tight mb-4 uppercase text-black">GIVEE<br />プロジェクト管理</h1>
                <div className="h-2 w-24 bg-black mx-auto mb-8"></div>
                <p className="text-xl md:text-2xl font-black text-black mb-14 tracking-[0.2em]">最高で最幸をGIVEする</p>
                <button onClick={() => navigate('/dashboard')} className="group relative inline-flex items-center justify-center px-16 py-6 bg-black text-white font-black text-2xl uppercase tracking-widest hover:bg-[#004097] transition-all transform active:scale-95 shadow-[10px_10px_0px_#EC6C00] hover:shadow-none border-4 border-black font-bold uppercase">ナイスギビー！</button>
              </div>
            </div>
          </div>
        } />
        {/* DASHBOARD 画面 */}
        <Route path="/dashboard" element={
          <div className="animate-in fade-in duration-500 max-w-full mx-auto p-4 lg:p-6 pb-24 text-black">
            <div className="flex justify-between items-end mb-8 text-black">
              <div className="relative text-black">
                <div className="absolute -top-6 -left-4 w-12 h-12 bg-[#FFE900]/60 rounded-full blur-xl animate-pulse"></div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter relative z-10 leading-none">運用案件ダッシュボード</h2>
                <p className="text-[9px] font-black tracking-[0.3em] opacity-40 mt-2 uppercase text-black font-black uppercase">Active projects: {projects.length}</p>
              </div>
              <button className="bg-black text-white px-6 py-2.5 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 hover:-translate-y-1 transition-all shadow-[6px_6px_0px_#FFE900] border-4 border-black" onClick={() => { setEditingProject(null); setIsProjectModalOpen(true); }}>+ 新規案件登録</button>
            </div>
            <div className="space-y-12 text-black">
              {[...creators, { id: 'none', name: '未定' }].map(creator => {
                const creatorProjects = projects.filter(p => (p.assigned_creator === creator.name) || (creator.id === 'none' && !p.assigned_creator));
                if (creatorProjects.length === 0) return null;
                return (
                  <div key={creator.id}>
                    <div className="flex items-center justify-between mb-3 border-b-4 border-black pb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-black border-2 border-black shadow-[2px_2px_0px_#000]" />
                        <h3 className="text-base md:text-lg font-black uppercase tracking-widest italic text-black">
                          {creator.name}
                        </h3>
                        <span className="ml-1 px-2 py-0.5 border-2 border-black bg-white text-[10px] md:text-xs font-black uppercase tracking-widest text-black shadow-[2px_2px_0px_#000]">
                          {creatorProjects.length}件
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 text-black">
                      {creatorProjects.map(project => (
                        <div 
                          key={project.id} 
                          onClick={() => navigate(`/project/${project.id}`)}
                          className="bg-white border-4 border-black p-3 group cursor-pointer hover:bg-[#FFE900] transition-all relative flex items-center justify-center text-center shadow-[4px_4px_0px_rgba(0,0,0,0.05)] hover:shadow-none"
                        >
                          <h4 className="text-xs md:text-sm font-black uppercase italic text-black line-clamp-2 leading-snug text-center">{project.client}</h4>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        } />
        {/* DETAIL（案件詳細） */}
        <Route path="/project/:id" element={
          currentProject ? (
            <div className="animate-in slide-in-from-bottom-4 duration-500 text-black max-w-full mx-auto p-4 lg:p-6 pb-24">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 text-black">
                  <button onClick={() => navigate('/dashboard')} className="p-1.5 border-4 border-black hover:bg-black hover:text-white transition-all text-black"><ChevronLeft size={18} /></button>
                <h2 className="text-3xl lg:text-4xl font-black uppercase italic tracking-tighter text-black">{currentProject.client}</h2>
                <button onClick={() => { setEditingProject(currentProject); setIsProjectModalOpen(true); }} className="bg-black text-white px-3 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-[#004097] transition-all border-2 border-black shadow-[3px_3px_0px_#FFE900]">基本情報を更新</button>
              </div>
              <button 
                onClick={() => setShowPreShootTasks(!showPreShootTasks)}
                className={`flex items-center gap-2 px-4 py-2 border-4 border-black font-black text-[10px] uppercase tracking-widest transition-all ${showPreShootTasks ? 'bg-white hover:bg-slate-50' : 'bg-black text-white'}`}
              >
                {showPreShootTasks ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPreShootTasks ? '初回タスクを隠す' : '初回タスクを表示'}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch font-black text-black">
              <div className="bg-white border-4 border-black p-4 relative shadow-sm text-black">
                  <h3 className="text-sm md:text-base font-black uppercase tracking-widest italic text-black mb-4 border-b-2 border-black pb-1">案件情報</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-4 text-black font-black uppercase text-center">
                    <div className="col-span-1">
                      <p className="text-[10px] md:text-xs text-slate-500 italic mb-1 uppercase tracking-widest">Director</p>
                      <p className="text-sm md:text-base truncate">{currentProject.director}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[10px] md:text-xs text-slate-500 italic mb-1 uppercase tracking-widest">Creator</p>
                      <p className="text-sm md:text-base truncate">{currentProject.assigned_creator}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[10px] md:text-xs text-slate-500 italic mb-1 tracking-widest">契約月</p>
                      <p className="text-sm md:text-base font-mono">{currentProject.contract_month || '-'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[10px] md:text-xs text-slate-500 italic mb-1 tracking-widest">投稿開始月</p>
                      <p className="text-sm md:text-base font-mono">{currentProject.start_month || '-'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[10px] md:text-xs text-slate-500 italic mb-1 tracking-widest">契約満了月</p>
                      <p className="text-sm md:text-base font-mono">{currentProject.expiry_month || '-'}</p>
                    </div>
                  </div>
              </div>
              <div className="bg-white border-4 border-black relative flex flex-col text-black shadow-sm font-black">
                <div className="px-3 py-1.5 border-b-2 border-black flex items-center justify-between bg-slate-50 font-black">
                  <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 italic font-bold text-black font-black"><StickyNote size={14} /> 共有メモ・注意事項</h3>
                </div>
                <textarea 
                  value={currentProject.memo}
                    onChange={(e) => setProjects(projects.map(p => p.id === projectId ? { ...p, memo: e.target.value } : p))}
                  placeholder="注意事項を入力..."
                  className="flex-1 w-full p-3 text-[11px] font-black leading-relaxed outline-none min-h-[80px] resize-none focus:bg-[#FFE900]/5 text-black border-none"
                />
              </div>
            </div>

            <div className="space-y-4 text-black">
              {showPreShootTasks && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                  <TaskTable category="PRE_SHOOT" title="初回撮影までのタスク" icon={Camera} colorClass="bg-[#FFE900]" isFull={true} />
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TaskTable category="OP_EXEC" title="編集投稿スケジュール" icon={RefreshCw} colorClass="bg-[#EC6C00] text-white" />
                  <TaskTable
                    category="OP_PREP"
                    title="次回撮影の準備"
                    icon={Settings}
                    colorClass="bg-[#004097] text-white"
                    headerRight={(() => {
                      const missing = !nextShootCount || !nextShootDate;
                      return (
                        <div className={`flex items-center gap-2 px-2 py-1 border-2 border-black ${missing ? 'bg-[#FFE900]' : 'bg-white'} text-black shadow-[2px_2px_0px_#000]`}>
                          <div className="flex items-center gap-1">
                            {missing ? <AlertTriangle size={14} /> : null}
                            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                              次回撮影{missing ? ' 未設定' : ''}
                            </span>
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={nextShootCount}
                            onChange={(e) => setNextShootCount(e.target.value)}
                            onBlur={() => persistNextShoot({ next_shoot_count: nextShootCount || '', next_shoot_date: nextShootDate || '' })}
                            placeholder="回"
                            className="w-14 bg-white border-2 border-black px-1 py-0.5 text-[10px] font-black outline-none text-black"
                            title="第◯回"
                          />
                          <input
                            type="date"
                            value={nextShootDate}
                            onChange={(e) => setNextShootDate(e.target.value)}
                            onBlur={() => persistNextShoot({ next_shoot_count: nextShootCount || '', next_shoot_date: nextShootDate || '' })}
                            className="w-[130px] bg-white border-2 border-black px-1 py-0.5 text-[10px] font-black outline-none text-black"
                            title="撮影日"
                          />
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 whitespace-nowrap">
                            {nextShootSaveState === 'saving' ? '保存中' : nextShootSaveState === 'saved' ? '保存済' : nextShootSaveState === 'error' ? 'エラー' : ''}
                          </span>
                        </div>
                      );
                    })()}
                  />
            </div>
          </div>
        </div>
          ) : (
            <div className="p-12 text-center text-lg font-black">案件が見つかりません</div>
          )
        } />
        {/* DIRECTORY: 一覧ページ */}
        <Route path="/directory/:type" element={<DirectoryRoute />} />
      </Routes>
      {/* フッターナビゲーション部分等は省略可 */}
      {/* 案件設定モーダル（そのまま） */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 text-black">
          <div className="bg-white border-4 border-black w-full max-md relative text-black shadow-[16px_16px_0px_#FFE900]">
            <div className="bg-black text-white p-6 flex justify-between items-center text-white font-black uppercase">
              <h3 className="text-xl font-black italic">{editingProject ? '設定の編集' : '新規登録'}</h3>
              <button
                onClick={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
                className="hover:rotate-90 transition-transform text-white"
              >
                <X size={28} />
              </button>
            </div>
            <form onSubmit={saveProject} className="p-8 space-y-6 font-black text-black">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 italic text-black">
                  Client Name / クライアント名
                </label>
                <input
                  name="client"
                  required
                  defaultValue={editingProject?.client}
                  className="w-full px-4 py-3 border-4 border-black font-black uppercase outline-none focus:bg-[#FFE900] text-black shadow-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-black">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest leading-none text-black">Director</label>
                  <select
                    name="director"
                    defaultValue={editingProject?.director || directors[0]?.name || ''}
                    className="w-full px-4 py-3 border-2 border-black font-black bg-white outline-none text-black cursor-pointer hover:bg-slate-50"
                  >
                    {directors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest leading-none text-black">Creator</label>
                  <select
                    name="assigned_creator"
                    defaultValue={editingProject?.assigned_creator || creators[0]?.name || ''}
                    className="w-full px-4 py-3 border-2 border-black font-black bg-white outline-none text-black cursor-pointer hover:bg-slate-50"
                  >
                    {creators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-black">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic leading-none text-black">投稿開始月 (任意)</label>
                  <input
                    name="start_month"
                    type="month"
                    defaultValue={editingProject?.start_month || ""}
                    className="w-full px-4 py-3 border-4 border-black font-black outline-none shadow-none text-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic leading-none text-black">契約締結月 (任意)</label>
                  <input
                    name="contract_month"
                    type="month"
                    defaultValue={editingProject?.contract_month || ""}
                    className="w-full px-4 py-3 border-4 border-black font-black outline-none shadow-none text-black"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic leading-none text-black">契約満了月 (任意)</label>
                <input
                  name="expiry_month"
                  type="month"
                  defaultValue={editingProject?.expiry_month || ""}
                  className="w-full px-4 py-3 border-4 border-black font-black outline-none shadow-none text-black"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest italic leading-none text-black">共有メモ (任意)</label>
                <textarea
                  name="memo"
                  rows="3"
                  defaultValue={editingProject?.memo || ''}
                  className="w-full px-4 py-3 border-4 border-black font-black outline-none resize-none focus:bg-slate-50 text-black shadow-none transition-colors"
                />
              </div>
              <button type="submit" className="w-full py-5 bg-black text-white font-black uppercase tracking-[0.3em] shadow-[10px_10px_0px_#004097] active:translate-y-1 active:shadow-none transition-all text-xl border-4 border-black">
                確定
              </button>
            </form>
          </div>
        </div>
      )}
      {/* 名簿登録モーダルも同様 */}
      {isPersonModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 text-black font-bold">
          <div className="bg-white border-4 border-black w-full max-w-md relative text-black shadow-[20px_20px_0px_#EC6C00]">
            <div className={`p-5 border-b-4 border-black flex justify-between items-center ${personModalType === 'creator' ? 'bg-[#EC6C00]' : 'bg-[#004097]'} text-white font-black`}>
              <h3 className="text-sm font-black uppercase italic tracking-widest">
                {personModalType === 'creator' ? 'クリエイター' : 'ディレクター'}登録
              </h3>
              <button onClick={() => { setIsPersonModalOpen(false); setEditingPerson(null); }} className="text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={savePerson} className="p-8 space-y-6 text-black">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 italic text-black uppercase">
                  {personModalType === 'creator' ? 'クリエイター名' : 'ディレクター名'}
                </label>
                <input
                  name="name"
                  required
                  defaultValue={editingPerson?.name}
                  placeholder="例: 田中 太郎"
                  className="w-full px-4 py-3 border-4 border-black font-black outline-none focus:bg-slate-50 text-black shadow-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 italic text-black uppercase">Email / メールアドレス</label>
                <input
                  name="email"
                  required
                  defaultValue={editingPerson?.email}
                  placeholder="例: info@givee.jp"
                  className="w-full px-4 py-3 border-4 border-black font-black outline-none focus:bg-slate-50 text-black shadow-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 italic text-black uppercase">Remarks / 備考</label>
                <textarea
                  name="note"
                  rows="3"
                  defaultValue={editingPerson?.note}
                  placeholder="例: リール編集が得意 / 毎週火曜休み"
                  className="w-full px-4 py-3 border-4 border-black font-black outline-none resize-none focus:bg-slate-50 text-black shadow-none transition-colors"
                />
              </div>
              <button type="submit" className="w-full py-4 bg-black text-white font-black uppercase tracking-[0.3em] hover:bg-[#004097] transition-all border-4 border-black shadow-[8px_8px_0px_#FFE900]">
                保存
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// DirectoryViewの定義
const DirectoryView = ({
  creators,
  directors,
  personType,
  setPersonModalType,
  setEditingPerson,
  setIsPersonModalOpen,
  handleDeletePerson
}) => {
  const people = personType === 'creator' ? creators : directors;
  return (
    <div className="animate-in fade-in duration-300 text-black font-bold">
      <div className="flex justify-between items-end mb-8 text-black uppercase font-black">
        <h2 className="text-3xl italic tracking-tighter">
          {personType === 'creator' ? 'クリエイター' : 'ディレクター'} 一覧
        </h2>
        <button
          onClick={() => { setPersonModalType(personType); setEditingPerson(null); setIsPersonModalOpen(true); }}
          className="bg-black text-white px-6 py-2 font-black text-[10px] uppercase tracking-widest hover:bg-[#EC6C00] shadow-[6px_6px_0px_#FFE900] border-4 border-black"
        >
          + 新規登録
        </button>
      </div>
      <div className="border-4 border-black bg-white overflow-hidden shadow-xl text-black">
        <table className="w-full text-left border-collapse table-fixed text-black font-bold font-black">
          <thead>
            <tr className="bg-black text-white text-[10px] uppercase tracking-widest font-black">
              <th className="px-6 py-4 w-1/3">氏名</th>
              <th className="px-6 py-4 w-1/3 text-center">メールアドレス</th>
              <th className="px-6 py-4 w-1/3 text-center">備考</th>
              <th className="w-24 px-6 py-4 text-center font-black uppercase">編集</th>
            </tr>
          </thead>
          <tbody className="divide-y-4 divide-black text-black">
            {people.map(person => (
              <tr key={person.id} className="hover:bg-[#FFE900]/20 transition-colors text-black font-bold">
                <td className="px-6 py-5 font-black text-lg italic">{person.name}</td>
                <td className="px-6 py-5 text-xs font-mono text-center">{person.email}</td>
                <td className="px-6 py-5 text-xs text-slate-400 truncate text-center">{person.note}</td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => { setPersonModalType(personType); setEditingPerson(person); setIsPersonModalOpen(true); }} className="hover:text-[#EC6C00] transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeletePerson(person.id, person.name, personType)} className="hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
