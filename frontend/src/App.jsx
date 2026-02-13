import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Users, TrendingUp, BarChart3, Bell, Menu, X,
  Plus, Clock, CheckCircle, Play, Search, Eye, Phone, Mail,
  Upload, Camera, ArrowLeft, Check, AlertCircle, Zap, Dumbbell
} from 'lucide-react';

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'https://coach-api-1770519048.azurewebsites.net/api/v1';

const api = {
  async request(ep, opts = {}) {
    try {
      const r = await fetch(`${API_URL}${ep}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
      const d = await r.json();
      if (!r.ok && !d.success) throw new Error(d.detail || d.message || 'Request failed');
      return d;
    } catch (e) { console.error('API:', e); throw e; }
  },
  getClients() { return this.request('/clients'); },
  createClient(d) { return this.request('/clients', { method: 'POST', body: JSON.stringify(d) }); },
  bulkImportClients(d) { return this.request('/clients/bulk-import', { method: 'POST', body: JSON.stringify(d) }); },
  getWorkouts(c) { return this.request(c ? `/workouts/library?category=${c}` : '/workouts/library'); },
  createWorkout(d) { return this.request('/workouts/library', { method: 'POST', body: JSON.stringify(d) }); },
  bulkImportWorkouts(d) { return this.request('/workouts/bulk-import', { method: 'POST', body: JSON.stringify(d) }); },
  getSessions(p) { const q = p ? '?' + new URLSearchParams(p).toString() : ''; return this.request(`/sessions${q}`); },
  getTodaySchedule() { return this.request('/schedule/today'); },
  bulkPlanSessions(d) { return this.request('/schedule/bulk-plan', { method: 'POST', body: JSON.stringify(d) }); },
  createSession(d) { return this.request('/sessions', { method: 'POST', body: JSON.stringify(d) }); },
  createRecurringSessions(d) { return this.request('/sessions/create-recurring', { method: 'POST', body: JSON.stringify(d) }); },
  startSession(id) { return this.request(`/sessions/${id}/start`, { method: 'POST' }); },
  completeSession(id, d) { return this.request(`/sessions/${id}/complete`, { method: 'POST', body: JSON.stringify(d) }); },
  markAttendance(id, s) { return this.request(`/sessions/${id}/mark-attendance`, { method: 'POST', body: JSON.stringify({ status: s }) }); },
  cancelSession(id, r) { return this.request(`/sessions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: r, cancelled_by: 'coach' }) }); },
  sendReminders(ids, m) { return this.request('/reminders/send', { method: 'POST', body: JSON.stringify({ session_ids: ids, method: m }) }); },
  getDashboardStats() { return this.request('/dashboard/stats'); },
  getClientConsistency(id) { return this.request(`/progress/consistency/${id}`); },
  uploadProgress(d) { return this.request('/progress/upload', { method: 'POST', body: JSON.stringify(d) }); },
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const s = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl ${s[size]} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="hover:bg-slate-100 p-2 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed top-4 right-4 z-[60] ${type === 'error' ? 'bg-red-500' : 'bg-emerald-500'} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideIn`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, subtitle, action }) => (
  <div className="text-center py-16">
    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Icon size={36} className="text-slate-400" /></div>
    <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
    <p className="text-slate-500 mb-4">{subtitle}</p>
    {action}
  </div>
);

const StatusBadge = ({ status }) => {
  const st = { scheduled:'bg-blue-100 text-blue-700', in_progress:'bg-yellow-100 text-yellow-800', completed:'bg-emerald-100 text-emerald-700', cancelled:'bg-red-100 text-red-700', no_show:'bg-orange-100 text-orange-700' };
  const lb = { scheduled:'Scheduled', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'Absent' };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${st[status]||'bg-slate-100 text-slate-600'}`}>{lb[status]||status}</span>;
};

const BulkImportForm = ({ type, onSubmit, columns, sampleRow }) => {
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const handleFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { setCsvText(ev.target.result); setParsed(parseCSV(ev.target.result)); }; r.readAsText(f); };
  const handleSubmit = async () => { if (!parsed.length) return; setLoading(true); await onSubmit(parsed); setLoading(false); };
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-sm"><p className="font-semibold text-blue-800 mb-1">CSV columns:</p><code className="text-blue-600">{columns.join(', ')}</code><p className="text-blue-600 mt-1">Example: <code>{sampleRow}</code></p></div>
      <div className="flex gap-2"><input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" /><button onClick={() => fileRef.current?.click()} className="flex-1 py-3 border-2 border-dashed rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"><Upload size={18} /> Choose CSV file</button></div>
      <div><label className="block text-sm font-medium mb-1">Or paste CSV data:</label><textarea value={csvText} onChange={e => { setCsvText(e.target.value); setParsed(parseCSV(e.target.value)); }} rows={5} className="w-full px-4 py-3 rounded-xl border outline-none font-mono text-sm" placeholder={`${columns.join(',')}\n${sampleRow}`} /></div>
      {parsed.length > 0 && <div className="bg-emerald-50 rounded-xl p-4"><p className="font-semibold text-emerald-800">{parsed.length} {type} ready to import</p></div>}
      <button onClick={handleSubmit} disabled={loading || !parsed.length} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Importing...' : `Import ${parsed.length} ${type}`}</button>
    </div>
  );
};

// === TODAY VIEW ===
const TodayView = ({ onNavigate, showToast }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getTodaySchedule();
      if (r.success) setSessions(r.sessions || []);
    } catch(e) {
      try { const r = await api.getSessions(); if (r.success) { const today = new Date().toDateString(); setSessions((r.sessions||[]).filter(s => new Date(s.scheduled_at).toDateString() === today)); } } catch(e2) {}
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAttendance = async (id, status) => {
    try { await api.markAttendance(id, status); showToast(`Marked as ${status === 'attended' ? 'present' : 'absent'}`); load(); } catch (e) { showToast('Failed', 'error'); }
  };
  const handleStart = async (session) => {
    try { const r = await api.startSession(session.id); if (r.success) { setActiveSession({ ...session, status: 'in_progress', workout: r.workout }); showToast('Session started!'); load(); } } catch (e) { showToast('Failed to start', 'error'); }
  };
  const handleComplete = async (sessionId, notes, exercisesCompleted) => {
    try { await api.completeSession(sessionId, { notes, exercises_completed: exercisesCompleted }); showToast('Session completed!'); setActiveSession(null); load(); } catch (e) { showToast('Failed', 'error'); }
  };
  const handleReminders = async () => {
    const pending = sessions.filter(s => s.status === 'scheduled').map(s => s.id);
    if (!pending.length) { showToast('No upcoming sessions', 'info'); return; }
    try { await api.sendReminders(pending, 'sms'); showToast(`Reminders sent to ${pending.length} clients`); } catch (e) { showToast('Failed', 'error'); }
  };

  if (activeSession) return <ActiveSessionView session={activeSession} onComplete={handleComplete} onBack={() => { setActiveSession(null); load(); }} showToast={showToast} />;

  const upcoming = sessions.filter(s => s.status === 'scheduled' || s.status === 'confirmed');
  const inProgress = sessions.filter(s => s.status === 'in_progress');
  const done = sessions.filter(s => ['completed','no_show','cancelled'].includes(s.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Today's Schedule</h1><p className="text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
        <div className="flex gap-2">
          {upcoming.length > 0 && <button onClick={handleReminders} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium"><Bell size={16} /> Send Reminders ({upcoming.length})</button>}
          <button onClick={load} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border"><div className="text-2xl font-bold">{sessions.length}</div><div className="text-xs text-slate-500">Total Today</div></div>
        <div className="bg-white rounded-xl p-4 border"><div className="text-2xl font-bold text-blue-600">{upcoming.length}</div><div className="text-xs text-slate-500">Upcoming</div></div>
        <div className="bg-white rounded-xl p-4 border"><div className="text-2xl font-bold text-yellow-600">{inProgress.length}</div><div className="text-xs text-slate-500">In Progress</div></div>
        <div className="bg-white rounded-xl p-4 border"><div className="text-2xl font-bold text-emerald-600">{done.filter(s=>s.status==='completed').length}</div><div className="text-xs text-slate-500">Completed</div></div>
      </div>

      {loading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
       sessions.length === 0 ? <EmptyState icon={Calendar} title="No sessions today" subtitle="Schedule sessions from the Planner tab" action={<button onClick={() => onNavigate('schedule')} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium">Go to Planner</button>} /> :
      <div className="space-y-3">
        {inProgress.map(s => (
          <div key={s.id} className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-400 text-white flex items-center justify-center text-lg font-bold">{(s.client_name||'?')[0]}</div>
                <div><h3 className="font-bold text-lg">{s.client_name}</h3><p className="text-sm text-slate-600">{s.workout_name || 'General Session'}</p></div>
              </div>
              <button onClick={() => setActiveSession(s)} className="px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 flex items-center gap-2"><Eye size={18} /> View Session</button>
            </div>
          </div>
        ))}
        {upcoming.map(s => (
          <div key={s.id} className="bg-white border rounded-2xl p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg font-bold">{(s.client_name||'?')[0]}</div>
                <div>
                  <h3 className="font-bold text-lg">{s.client_name}</h3>
                  <p className="text-sm text-slate-500">{new Date(s.scheduled_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}{s.workout_name && <> &bull; <span className="text-indigo-600">{s.workout_name}</span></>}{s.duration_minutes && <> &bull; {s.duration_minutes}min</>}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleAttendance(s.id, 'attended')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600">Present</button>
                <button onClick={() => handleAttendance(s.id, 'absent')} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600">Absent</button>
                <button onClick={() => handleStart(s)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-1"><Play size={14} /> Start</button>
              </div>
            </div>
          </div>
        ))}
        {done.length > 0 && <>
          <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider pt-4">Completed</div>
          {done.map(s => (
            <div key={s.id} className="bg-slate-50 border rounded-2xl p-4 opacity-75">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center font-bold">{(s.client_name||'?')[0]}</div><span className="font-semibold text-slate-600">{s.client_name}</span></div>
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </>}
      </div>}
    </div>
  );
};

// === ACTIVE SESSION (Workout checklist) ===
const ActiveSessionView = ({ session, onComplete, onBack }) => {
  const [exercises, setExercises] = useState([]);
  const [notes, setNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let exList = [];
    const structure = session.workout?.structure || session.workout_structure;
    if (structure) {
      const s = typeof structure === 'string' ? JSON.parse(structure) : structure;
      if (Array.isArray(s.exercises)) exList = s.exercises.map((e, i) => ({ ...e, id: i, done: false }));
      else if (s.equipment) exList = (Array.isArray(s.equipment) ? s.equipment : []).map((e, i) => ({ name: e, id: i, done: false }));
    }
    if (!exList.length) exList = [{ id: 0, name: 'Warm-up', done: false }, { id: 1, name: 'Main workout', done: false }, { id: 2, name: 'Cool-down', done: false }];
    setExercises(exList);
  }, [session]);

  const toggle = (id) => setExercises(prev => prev.map(e => e.id === id ? { ...e, done: !e.done } : e));
  const doneCount = exercises.filter(e => e.done).length;

  const handleComplete = async () => { setCompleting(true); await onComplete(session.id, notes, exercises.filter(e => e.done).map(e => e.name)); setCompleting(false); };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium"><ArrowLeft size={18} /> Back to Today</button>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div><div className="text-sm opacity-80">Session in progress</div><h2 className="text-2xl font-bold mt-1">{session.client_name}</h2><p className="opacity-80">{session.workout_name || 'General Session'}</p></div>
          <div className="text-right"><div className="text-4xl font-bold">{doneCount}/{exercises.length}</div><div className="text-sm opacity-80">exercises</div></div>
        </div>
        <div className="mt-4 bg-white/20 rounded-full h-3"><div className="bg-white rounded-full h-3 transition-all" style={{ width: `${exercises.length ? (doneCount / exercises.length * 100) : 0}%` }} /></div>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between"><h3 className="font-bold text-lg">Workout Checklist</h3><button onClick={() => setExercises(prev => prev.map(e => ({...e, done: true})))} className="text-sm text-blue-600 font-medium">Mark all done</button></div>
        <div className="divide-y">
          {exercises.map(ex => (
            <button key={ex.id} onClick={() => toggle(ex.id)} className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 ${ex.done ? 'bg-emerald-50' : ''}`}>
              <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${ex.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>{ex.done && <Check size={18} />}</div>
              <span className={`font-medium flex-1 ${ex.done ? 'text-emerald-700 line-through' : ''}`}>{ex.name}</span>
              {ex.sets && <span className="text-sm text-slate-400">{ex.sets}x{ex.reps}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-6"><h3 className="font-bold mb-3">Session Notes</h3><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border outline-none resize-none" placeholder="How did the session go?" /></div>
      <button onClick={handleComplete} disabled={completing} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
        {completing ? 'Completing...' : <><CheckCircle size={22} /> Complete Session ({doneCount}/{exercises.length})</>}
      </button>
    </div>
  );
};

// === CLIENTS VIEW ===
const ClientsView = ({ showToast }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => { setLoading(true); try { const r = await api.getClients(); if (r.success) setClients(r.clients||[]); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const filtered = clients.filter(c => (c.name||'').toLowerCase().includes(search.toLowerCase()) || (c.email||'').toLowerCase().includes(search.toLowerCase()) || (c.phone||'').includes(search));

  const handleAdd = async (d) => { try { await api.createClient(d); showToast('Client added!'); setShowAdd(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleImport = async (d) => { try { const r = await api.bulkImportClients({ clients: d }); showToast(r.message); setShowImport(false); load(); } catch (e) { showToast(e.message, 'error'); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium"><Upload size={16} /> Import CSV</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> Add Client</button>
        </div>
      </div>
      <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none" placeholder="Search by name, email, or phone..." /></div>

      {loading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
       filtered.length === 0 ? <EmptyState icon={Users} title="No clients" subtitle="Add your first client or import from CSV" /> :
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th><th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Contact</th><th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Joined</th></tr></thead>
        <tbody className="divide-y">{filtered.map(c => (
          <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c)}>
            <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold">{(c.name||'?')[0]}</div><span className="font-semibold">{c.name}</span></div></td>
            <td className="px-6 py-4 text-sm text-slate-500">{c.phone || c.email || '-'}</td>
            <td className="px-6 py-4 text-sm text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
          </tr>
        ))}</tbody></table>
      </div>}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Client" size="sm">
        {(() => { const F = () => { const [f,sF]=useState({name:'',email:'',phone:''}); const [l,sL]=useState(false); return (
          <form onSubmit={async e => { e.preventDefault(); sL(true); await handleAdd(f); sL(false); }} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Name *</label><input required value={f.name} onChange={e=>sF({...f,name:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={f.email} onChange={e=>sF({...f,email:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div><div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={f.phone} onChange={e=>sF({...f,phone:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="+91..." /></div></div>
            <button type="submit" disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Adding...':'Add Client'}</button>
          </form>); }; return <F />; })()}
      </Modal>
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Clients" size="md"><BulkImportForm type="clients" onSubmit={handleImport} columns={['name','email','phone','age','gender','goal']} sampleRow="John Doe,john@email.com,+919876543210,28,male,weight loss" /></Modal>
      {selected && <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected.name} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {selected.email && <div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Email</div><div className="font-medium">{selected.email}</div></div>}
            {selected.phone && <div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Phone</div><div className="font-medium">{selected.phone}</div></div>}
          </div>
        </div>
      </Modal>}
    </div>
  );
};

// === WORKOUTS VIEW ===
const WorkoutsView = ({ showToast }) => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => { setLoading(true); try { const r = await api.getWorkouts(filter === 'all' ? null : filter); if (r.success) setWorkouts(r.workouts||[]); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [filter]);

  const handleAdd = async (d) => { try { await api.createWorkout(d); showToast('Workout added!'); setShowAdd(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleImport = async (d) => { try { const r = await api.bulkImportWorkouts({ workouts: d }); showToast(r.message); setShowImport(false); load(); } catch (e) { showToast(e.message, 'error'); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Workout Library</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium"><Upload size={16} /> Import CSV</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> Add Workout</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">{['all','strength','cardio','hiit','yoga','pilates','gym'].map(c => <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${filter===c?'bg-blue-600 text-white':'bg-white border hover:bg-slate-50'}`}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>)}</div>

      {loading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
       workouts.length === 0 ? <EmptyState icon={Dumbbell} title="No workouts" subtitle="Add or import workouts" /> :
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{workouts.map(w => (
        <div key={w.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-3"><span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">{w.category}</span>{w.duration_minutes && <span className="text-xs text-slate-400">{w.duration_minutes}min</span>}</div>
          <h3 className="font-bold text-lg mb-1">{w.name}</h3><p className="text-sm text-slate-500 line-clamp-2">{w.description || 'No description'}</p>
        </div>
      ))}</div>}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Workout" size="sm">
        {(() => { const F = () => { const [f,sF]=useState({name:'',description:'',category:'strength',duration_minutes:30}); const [l,sL]=useState(false); return (
          <form onSubmit={async e => { e.preventDefault(); sL(true); await handleAdd(f); sL(false); }} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Name *</label><input required value={f.name} onChange={e=>sF({...f,name:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div>
            <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={f.description} onChange={e=>sF({...f,description:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Category</label><select value={f.category} onChange={e=>sF({...f,category:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none">{['strength','cardio','hiit','yoga','pilates','gym'].map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Duration (min)</label><input type="number" value={f.duration_minutes} onChange={e=>sF({...f,duration_minutes:parseInt(e.target.value)||30})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div></div>
            <button type="submit" disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Adding...':'Add Workout'}</button>
          </form>); }; return <F />; })()}
      </Modal>
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Workouts" size="md"><BulkImportForm type="workouts" onSubmit={handleImport} columns={['name','description','category','duration_minutes']} sampleRow="Bench Press,Flat barbell press,strength,15" /></Modal>
    </div>
  );
};

// === SCHEDULE PLANNER ===
const ScheduleView = ({ showToast }) => {
  const [clients, setClients] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showPlan, setShowPlan] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); const [c,w,s] = await Promise.all([api.getClients(),api.getWorkouts(),api.getSessions()]); if(c.success) setClients(c.clients||[]); if(w.success) setWorkouts(w.workouts||[]); if(s.success) setSessions(s.sessions||[]); setLoading(false); };
  useEffect(() => { load(); }, []);

  const grouped = {}; sessions.forEach(s => { const d = new Date(s.scheduled_at).toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'}); if(!grouped[d]) grouped[d]=[]; grouped[d].push(s); });

  const handlePlan = async (d) => {
    try {
      if (d.recurrence_type && d.recurrence_type !== 'once') { const [dt,tm] = d.scheduled_at.split('T'); await api.createRecurringSessions({client_id:d.client_id,recurrence_type:d.recurrence_type,start_date:dt,time:tm||'09:00',num_sessions:d.num_sessions||4,duration_minutes:d.duration_minutes,location:d.location}); }
      else { await api.createSession(d); }
      showToast('Session(s) scheduled!'); setShowPlan(false); load();
    } catch (e) { showToast(e.message, 'error'); }
  };
  const handleBulk = async (rows) => { try { const r = await api.bulkPlanSessions({sessions:rows}); showToast(r.message); setShowBulk(false); load(); } catch (e) { showToast(e.message, 'error'); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Schedule Planner</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium"><Zap size={16} /> Bulk Plan</button>
          <button onClick={() => setShowPlan(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> Schedule</button>
        </div>
      </div>

      {loading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
       sessions.length === 0 ? <EmptyState icon={Calendar} title="No sessions" subtitle="Start scheduling" /> :
      <div className="space-y-6">{Object.entries(grouped).map(([date, ds]) => (
        <div key={date}><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{date}</h3>
          <div className="space-y-2">{ds.map(s => (
            <div key={s.id} className="bg-white border rounded-xl p-4 flex items-center justify-between hover:shadow-sm">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{(s.client_name||'?')[0]}</div><div><span className="font-semibold">{s.client_name}</span><span className="text-sm text-slate-400 ml-2">{new Date(s.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>{s.template_name&&<span className="text-sm text-indigo-500 ml-2">{s.template_name}</span>}</div></div>
              <StatusBadge status={s.status} />
            </div>
          ))}</div>
        </div>
      ))}</div>}

      <Modal isOpen={showPlan} onClose={() => setShowPlan(false)} title="Schedule Session" size="md">
        {(() => { const F = () => { const [f,sF]=useState({client_id:'',scheduled_at:'',duration_minutes:60,location:'offline',workout_id:'',recurrence_type:'once',num_sessions:4}); const [l,sL]=useState(false); return (
          <form onSubmit={async e => { e.preventDefault(); sL(true); await handlePlan(f); sL(false); }} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Client *</label><select required value={f.client_id} onChange={e=>sF({...f,client_id:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none"><option value="">Select...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-1">Workout</label><select value={f.workout_id} onChange={e=>sF({...f,workout_id:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none"><option value="">None</option>{workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Date & Time *</label><input required type="datetime-local" value={f.scheduled_at} onChange={e=>sF({...f,scheduled_at:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div><div><label className="block text-sm font-medium mb-1">Duration</label><input type="number" value={f.duration_minutes} onChange={e=>sF({...f,duration_minutes:parseInt(e.target.value)||60})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Recurrence</label><select value={f.recurrence_type} onChange={e=>sF({...f,recurrence_type:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none"><option value="once">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option></select></div>{f.recurrence_type!=='once'&&<div><label className="block text-sm font-medium mb-1"># Sessions</label><input type="number" min="1" max="52" value={f.num_sessions} onChange={e=>sF({...f,num_sessions:parseInt(e.target.value)||4})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div>}</div>
            <button type="submit" disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Scheduling...':'Schedule'}</button>
          </form>); }; return <F />; })()}
      </Modal>

      <Modal isOpen={showBulk} onClose={() => setShowBulk(false)} title="Bulk Plan Sessions" size="lg">
        {(() => { const F = () => { const [rows,sR]=useState([{client_id:'',scheduled_at:'',workout_id:'',duration_minutes:60}]); const [l,sL]=useState(false);
          const add=()=>sR([...rows,{client_id:'',scheduled_at:'',workout_id:'',duration_minutes:60}]);
          const upd=(i,k,v)=>{const n=[...rows];n[i][k]=v;sR(n);};
          const rm=(i)=>sR(rows.filter((_,idx)=>idx!==i));
          return (<div className="space-y-4"><p className="text-sm text-slate-500">Plan multiple sessions at once.</p>
            <div className="space-y-3 max-h-80 overflow-y-auto">{rows.map((r,i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">{i===0&&<label className="block text-xs font-medium mb-1">Client</label>}<select value={r.client_id} onChange={e=>upd(i,'client_id',e.target.value)} className="w-full px-3 py-2 rounded-lg border outline-none text-sm"><option value="">Select...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="col-span-3">{i===0&&<label className="block text-xs font-medium mb-1">Date & Time</label>}<input type="datetime-local" value={r.scheduled_at} onChange={e=>upd(i,'scheduled_at',e.target.value)} className="w-full px-3 py-2 rounded-lg border outline-none text-sm" /></div>
                <div className="col-span-3">{i===0&&<label className="block text-xs font-medium mb-1">Workout</label>}<select value={r.workout_id} onChange={e=>upd(i,'workout_id',e.target.value)} className="w-full px-3 py-2 rounded-lg border outline-none text-sm"><option value="">None</option>{workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                <div className="col-span-1">{i===0&&<label className="block text-xs font-medium mb-1">Min</label>}<input type="number" value={r.duration_minutes} onChange={e=>upd(i,'duration_minutes',parseInt(e.target.value)||60)} className="w-full px-2 py-2 rounded-lg border outline-none text-sm" /></div>
                <div className="col-span-1">{rows.length>1&&<button onClick={()=>rm(i)} className="p-2 text-red-400 hover:text-red-600"><X size={16}/></button>}</div>
              </div>))}</div>
            <button onClick={add} className="w-full py-2 border-2 border-dashed rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50">+ Add row</button>
            <button onClick={async()=>{const v=rows.filter(r=>r.client_id&&r.scheduled_at); if(!v.length) return; sL(true); await handleBulk(v); sL(false);}} disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Planning...':`Plan ${rows.filter(r=>r.client_id&&r.scheduled_at).length} Session(s)`}</button>
          </div>); }; return <F />; })()}
      </Modal>
    </div>
  );
};

// === PROGRESS VIEW ===
const ProgressView = ({ showToast }) => {
  const [clients, setClients] = useState([]);
  const [sel, setSel] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.getClients().then(r => r.success && setClients(r.clients||[])); }, []);
  const handle = async () => { if (!sel) { showToast('Select client', 'error'); return; } setLoading(true); try { await api.uploadProgress({ client_id: sel, type: 'measurement', weight: weight ? parseFloat(weight) : null, notes, measurements: {}, photos: [] }); showToast('Progress recorded!'); setWeight(''); setNotes(''); } catch (e) { showToast(e.message, 'error'); } setLoading(false); };
  return (
    <div className="space-y-6"><h1 className="text-2xl font-bold">Client Progress</h1>
      <div className="bg-white rounded-2xl border p-6 space-y-4"><h3 className="font-bold text-lg">Record Progress</h3>
        <div><label className="block text-sm font-medium mb-1">Client *</label><select value={sel} onChange={e=>setSel(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none"><option value="">Select...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Weight (kg)</label><input type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="72.5" /></div><div><label className="block text-sm font-medium mb-1">Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Progress notes..." /></div></div>
        <div className="bg-slate-50 border-2 border-dashed rounded-xl p-8 text-center"><Camera size={32} className="mx-auto text-slate-400 mb-2" /><p className="text-sm text-slate-500">Photo upload coming soon</p></div>
        <button onClick={handle} disabled={loading||!sel} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">{loading?'Saving...':'Save Progress'}</button>
      </div>
    </div>
  );
};

// === DASHBOARD ===
const DashboardView = () => {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  useEffect(() => { api.getDashboardStats().then(r=>r.success&&setStats(r.stats)); api.getSessions().then(r=>r.success&&setSessions((r.sessions||[]).slice(0,8))); }, []);
  return (
    <div className="space-y-6"><h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border p-5"><div className="text-3xl font-bold">{stats?.total_clients||0}</div><div className="text-sm text-slate-500 mt-1">Clients</div></div>
        <div className="bg-white rounded-2xl border p-5"><div className="text-3xl font-bold text-blue-600">{stats?.total_sessions||0}</div><div className="text-sm text-slate-500 mt-1">Sessions</div></div>
        <div className="bg-white rounded-2xl border p-5"><div className="text-3xl font-bold text-emerald-600">{stats?.completed_sessions||0}</div><div className="text-sm text-slate-500 mt-1">Completed</div></div>
        <div className="bg-white rounded-2xl border p-5"><div className="text-3xl font-bold text-indigo-600">{stats?.total_workouts||0}</div><div className="text-sm text-slate-500 mt-1">Workouts</div></div>
      </div>
      <div className="bg-white rounded-2xl border p-6"><h2 className="font-bold text-lg mb-4">Recent Sessions</h2>
        <div className="space-y-2">{sessions.map(s=>(
          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{(s.client_name||'?')[0]}</div><div><span className="font-medium text-sm">{s.client_name}</span><span className="text-xs text-slate-400 ml-2">{new Date(s.scheduled_at).toLocaleDateString()}</span></div></div><StatusBadge status={s.status} /></div>
        ))}{sessions.length===0&&<p className="text-slate-400 text-sm text-center py-4">No sessions yet</p>}</div>
      </div>
    </div>
  );
};

// === MAIN APP ===
const navItems = [
  { id: 'today', icon: Zap, label: 'Today' },
  { id: 'clients', icon: Users, label: 'Clients' },
  { id: 'workouts', icon: Dumbbell, label: 'Workouts' },
  { id: 'schedule', icon: Calendar, label: 'Planner' },
  { id: 'progress', icon: TrendingUp, label: 'Progress' },
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
];

function App() {
  const [tab, setTab] = useState('today');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r flex flex-col z-50 transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">F</div><span className="font-bold text-lg">FitLife Coach</span></div><button onClick={() => setMobileOpen(false)} className="lg:hidden"><X size={20} /></button></div></div>
        <nav className="flex-1 p-3 space-y-1">{navItems.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setMobileOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><item.icon size={20} />{item.label}</button>
        ))}</nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden"><Menu size={24} /></button>
          <div className="text-sm text-slate-500 hidden lg:block">{navItems.find(n => n.id === tab)?.label}</div>
          <div className="text-sm text-slate-400">{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </header>
        <main className="flex-1 p-6 overflow-auto"><div className="max-w-6xl mx-auto">
          {tab === 'today' && <TodayView onNavigate={setTab} showToast={showToast} />}
          {tab === 'clients' && <ClientsView showToast={showToast} />}
          {tab === 'workouts' && <WorkoutsView showToast={showToast} />}
          {tab === 'schedule' && <ScheduleView showToast={showToast} />}
          {tab === 'progress' && <ProgressView showToast={showToast} />}
          {tab === 'dashboard' && <DashboardView />}
        </div></main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}.animate-slideIn{animation:slideIn .3s ease-out}`}</style>
    </div>
  );
}

export default App;
