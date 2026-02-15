import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Users, TrendingUp, BarChart3, Bell, Menu, X,
  Plus, CheckCircle, Play, Search, Eye, Upload, Camera, ArrowLeft,
  Check, AlertCircle, Zap, Dumbbell, Trash2, Send, DollarSign,
  MessageCircle, Mail, ExternalLink, Copy, Clock, Bot, Sparkles, Loader, Inbox, UserPlus
} from 'lucide-react';

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'https://coach-api-1770519048.azurewebsites.net/api/v1';

function getCoachId() { try { return JSON.parse(localStorage.getItem('coach_user') || '{}').id || ''; } catch { return ''; } }

const api = {
  async request(ep, opts = {}) {
    try {
      const coachId = getCoachId();
      const headers = { 'Content-Type': 'application/json', ...(coachId ? { 'X-Coach-Id': coachId } : {}), ...(opts.headers || {}) };
      const r = await fetch(`${API_URL}${ep}`, { ...opts, headers });
      const d = await r.json();
      // Detect stale session - foreign key errors mean coach_id is invalid
      if (!r.ok && d.detail && (d.detail.includes('foreign key') || d.detail.includes('not present in table') || d.detail === 'Valid coach ID required. Please login again.')) {
        localStorage.removeItem('coach_user');
        window.location.reload();
        throw new Error('Session expired. Please login again.');
      }
      if (!r.ok && !d.success) throw new Error(d.detail || d.message || 'Request failed');
      return d;
    } catch (e) { console.error('API:', e); throw e; }
  },
  getClients() { return this.request('/clients'); },
  createClient(d) { return this.request('/clients', { method: 'POST', body: JSON.stringify(d) }); },
  deleteClient(id) { return this.request(`/clients/${id}`, { method: 'DELETE' }); },
  bulkImportClients(d) { return this.request('/clients/bulk-import', { method: 'POST', body: JSON.stringify(d) }); },
  getWorkouts(c) { return this.request(c ? `/workouts/library?category=${c}` : '/workouts/library'); },
  createWorkout(d) { return this.request('/workouts/library', { method: 'POST', body: JSON.stringify(d) }); },
  deleteWorkout(id) { return this.request(`/workouts/${id}`, { method: 'DELETE' }); },
  bulkImportWorkouts(d) { return this.request('/workouts/bulk-import', { method: 'POST', body: JSON.stringify(d) }); },
  getSessions(p) { const q = p ? '?' + new URLSearchParams(p).toString() : ''; return this.request(`/sessions${q}`); },
  getTodaySchedule() { return this.request('/schedule/today'); },
  bulkPlanSessions(d) { return this.request('/schedule/bulk-plan', { method: 'POST', body: JSON.stringify(d) }); },
  createSession(d) { return this.request('/sessions', { method: 'POST', body: JSON.stringify(d) }); },
  createRecurringSessions(d) { return this.request('/sessions/create-recurring', { method: 'POST', body: JSON.stringify(d) }); },
  deleteSession(id) { return this.request(`/sessions/${id}`, { method: 'DELETE' }); },
  startSession(id) { return this.request(`/sessions/${id}/start`, { method: 'POST' }); },
  completeSession(id, d) { return this.request(`/sessions/${id}/complete`, { method: 'POST', body: JSON.stringify(d) }); },
  markAttendance(id, s) { return this.request(`/sessions/${id}/mark-attendance`, { method: 'POST', body: JSON.stringify({ status: s }) }); },
  cancelSession(id, r) { return this.request(`/sessions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: r, cancelled_by: 'coach' }) }); },
  sendReminders(ids, m) { return this.request('/reminders/send', { method: 'POST', body: JSON.stringify({ session_ids: ids, method: m }) }); },
  sendPersonalReminder(d) { return this.request('/reminders/send-personal', { method: 'POST', body: JSON.stringify(d) }); },
  createPaymentLink(d) { return this.request('/payments/create-razorpay-link', { method: 'POST', body: JSON.stringify(d) }); },
  getDashboardStats() { return this.request('/dashboard/stats'); },
  getClientConsistency(id) { return this.request(`/progress/consistency/${id}`); },
  uploadProgress(d) { return this.request('/progress/upload', { method: 'POST', body: JSON.stringify(d) }); },
  getLeads(status) { return this.request(status ? `/leads?status=${status}` : '/leads'); },
  updateLead(id, d) { return this.request(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(d) }); },
  convertLead(id) { return this.request(`/leads/${id}/convert`, { method: 'POST' }); },
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
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed top-4 right-4 z-[60] ${type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideIn`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, subtitle, action }) => (
  <div className="text-center py-16">
    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Icon size={36} className="text-slate-400" /></div>
    <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
    <p className="text-slate-500 mb-4">{subtitle}</p>{action}
  </div>
);

const StatusBadge = ({ status }) => {
  const st = { scheduled:'bg-blue-100 text-blue-700', in_progress:'bg-yellow-100 text-yellow-800', completed:'bg-emerald-100 text-emerald-700', cancelled:'bg-red-100 text-red-700', no_show:'bg-orange-100 text-orange-700' };
  const lb = { scheduled:'Scheduled', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'Absent' };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${st[status]||'bg-slate-100 text-slate-600'}`}>{lb[status]||status}</span>;
};

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
};

const BulkImportForm = ({ type, onSubmit, columns, sampleRow }) => {
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const handleFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { setCsvText(ev.target.result); setParsed(parseCSV(ev.target.result)); }; r.readAsText(f); };
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-sm"><p className="font-semibold text-blue-800 mb-1">CSV columns:</p><code className="text-blue-600">{columns.join(', ')}</code><p className="text-blue-600 mt-1">Example: <code>{sampleRow}</code></p></div>
      <div className="flex gap-2"><input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" /><button onClick={() => fileRef.current?.click()} className="flex-1 py-3 border-2 border-dashed rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"><Upload size={18} /> Choose CSV file</button></div>
      <div><label className="block text-sm font-medium mb-1">Or paste CSV data:</label><textarea value={csvText} onChange={e => { setCsvText(e.target.value); setParsed(parseCSV(e.target.value)); }} rows={5} className="w-full px-4 py-3 rounded-xl border outline-none font-mono text-sm" placeholder={`${columns.join(',')}\n${sampleRow}`} /></div>
      {parsed.length > 0 && <div className="bg-emerald-50 rounded-xl p-4"><p className="font-semibold text-emerald-800">{parsed.length} {type} ready to import</p></div>}
      <button onClick={async () => { if (!parsed.length) return; setLoading(true); await onSubmit(parsed); setLoading(false); }} disabled={loading || !parsed.length} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Importing...' : `Import ${parsed.length} ${type}`}</button>
    </div>
  );
};

// === TODAY VIEW ===
const TodayView = ({ onNavigate, showToast }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);

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
    try { await api.markAttendance(id, status); showToast(`Marked as ${status === 'attended' ? 'present' : 'absent'}`); load(); } catch (e) { showToast('Failed: ' + e.message, 'error'); }
  };
  const handleStart = async (session) => {
    try { const r = await api.startSession(session.id); if (r.success) { setActiveSession({ ...session, status: 'in_progress', workout: r.workout }); showToast('Session started!'); } } catch (e) { showToast('Failed: ' + e.message, 'error'); }
  };
  const handleComplete = async (sessionId, notes, exercisesCompleted) => {
    try { await api.completeSession(sessionId, { notes, exercises_completed: exercisesCompleted }); showToast('Session completed!'); setActiveSession(null); load(); } catch (e) { showToast('Failed', 'error'); }
  };
  const handleBulkReminders = async () => {
    const pending = sessions.filter(s => s.status === 'scheduled').map(s => s.id);
    if (!pending.length) { showToast('No upcoming sessions', 'info'); return; }
    try { await api.sendReminders(pending, 'sms'); showToast(`Reminders sent to ${pending.length} clients`); } catch (e) { showToast('Failed', 'error'); }
  };
  const handlePersonalReminder = async (session, method) => {
    try {
      const r = await api.sendPersonalReminder({ client_id: session.client_id, session_id: session.id, method });
      if (r.success && r.link) { window.open(r.link, '_blank'); showToast(`${method === 'whatsapp' ? 'WhatsApp' : 'Email'} opened for ${r.client_name}`); }
      else { showToast(r.message || 'Failed', 'error'); }
    } catch (e) { showToast(e.message, 'error'); }
    setReminderModal(null);
  };
  const handleDelete = async (id) => {
    if (!confirm('Delete this session?')) return;
    try { await api.deleteSession(id); showToast('Session deleted'); load(); } catch (e) { showToast('Failed', 'error'); }
  };

  if (activeSession) return <ActiveSessionView session={activeSession} onComplete={handleComplete} onBack={() => { setActiveSession(null); load(); }} />;

  const upcoming = sessions.filter(s => s.status === 'scheduled' || s.status === 'confirmed');
  const inProgress = sessions.filter(s => s.status === 'in_progress');
  const done = sessions.filter(s => ['completed','no_show','cancelled'].includes(s.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-slate-800">Today's Schedule</h1><p className="text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
        <div className="flex gap-2">
          {upcoming.length > 0 && <button onClick={handleBulkReminders} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium"><Bell size={16} /> Remind All ({upcoming.length})</button>}
          <button onClick={load} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium">Refresh</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border"><div className="text-2xl font-bold">{sessions.length}</div><div className="text-xs text-slate-500">Total</div></div>
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
              <button onClick={() => setActiveSession(s)} className="px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 flex items-center gap-2"><Eye size={18} /> View</button>
            </div>
          </div>
        ))}
        {upcoming.map(s => (
          <div key={s.id} className="bg-white border rounded-2xl p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0">{(s.client_name||'?')[0]}</div>
                <div className="min-w-0"><h3 className="font-bold text-lg truncate">{s.client_name}</h3><p className="text-sm text-slate-500 truncate">{new Date(s.scheduled_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}{s.workout_name && ` · ${s.workout_name}`}{s.duration_minutes && ` · ${s.duration_minutes}min`}</p></div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <button onClick={() => handleAttendance(s.id, 'attended')} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600">Present</button>
                <button onClick={() => handleAttendance(s.id, 'absent')} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600">Absent</button>
                <button onClick={() => handleStart(s)} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-1"><Play size={14} /> Start</button>
                <button onClick={() => setReminderModal(s)} className="px-2 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100" title="Send Reminder"><Send size={16} /></button>
                <button onClick={() => handleDelete(s.id)} className="px-2 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl" title="Delete"><Trash2 size={16} /></button>
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
                <div className="flex items-center gap-2"><StatusBadge status={s.status} /><button onClick={() => handleDelete(s.id)} className="px-2 py-2 text-slate-400 hover:text-red-500 rounded-xl"><Trash2 size={14} /></button></div>
              </div>
            </div>
          ))}
        </>}
      </div>}

      {/* Reminder Modal */}
      <Modal isOpen={!!reminderModal} onClose={() => setReminderModal(null)} title={`Send Reminder to ${reminderModal?.client_name || ''}`} size="sm">
        <div className="space-y-3">
          <button onClick={() => handlePersonalReminder(reminderModal, 'whatsapp')} className="w-full flex items-center gap-4 p-4 rounded-xl border hover:bg-green-50 hover:border-green-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-green-500 text-white flex items-center justify-center"><MessageCircle size={24} /></div>
            <div className="text-left"><div className="font-bold">WhatsApp</div><div className="text-sm text-slate-500">Opens WhatsApp with pre-filled message</div></div>
          </button>
          <button onClick={() => handlePersonalReminder(reminderModal, 'email')} className="w-full flex items-center gap-4 p-4 rounded-xl border hover:bg-blue-50 hover:border-blue-300 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center"><Mail size={24} /></div>
            <div className="text-left"><div className="font-bold">Email</div><div className="text-sm text-slate-500">Opens email client with pre-filled message</div></div>
          </button>
        </div>
      </Modal>
    </div>
  );
};

// === ACTIVE SESSION VIEW ===
const ActiveSessionView = ({ session, onComplete, onBack }) => {
  const [exercises, setExercises] = useState([]);
  const [notes, setNotes] = useState('');
  const [completing, setCompleting] = useState(false);
  useEffect(() => {
    let exList = [];
    const structure = session.workout?.structure || session.workout_structure;
    if (structure) { const s = typeof structure === 'string' ? JSON.parse(structure) : structure; if (Array.isArray(s.exercises)) exList = s.exercises.map((e, i) => ({ ...e, id: i, done: false })); }
    if (!exList.length) exList = [{ id: 0, name: 'Warm-up', done: false }, { id: 1, name: 'Main workout', done: false }, { id: 2, name: 'Cool-down', done: false }];
    setExercises(exList);
  }, [session]);
  const toggle = (id) => setExercises(p => p.map(e => e.id === id ? { ...e, done: !e.done } : e));
  const doneCount = exercises.filter(e => e.done).length;
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium"><ArrowLeft size={18} /> Back</button>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between"><div><div className="text-sm opacity-80">Session in progress</div><h2 className="text-2xl font-bold mt-1">{session.client_name}</h2><p className="opacity-80">{session.workout_name || 'General Session'}</p></div><div className="text-right"><div className="text-4xl font-bold">{doneCount}/{exercises.length}</div><div className="text-sm opacity-80">exercises</div></div></div>
        <div className="mt-4 bg-white/20 rounded-full h-3"><div className="bg-white rounded-full h-3 transition-all" style={{ width: `${exercises.length ? (doneCount / exercises.length * 100) : 0}%` }} /></div>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between"><h3 className="font-bold text-lg">Workout Checklist</h3><button onClick={() => setExercises(p => p.map(e => ({...e, done: true})))} className="text-sm text-blue-600 font-medium">Mark all</button></div>
        <div className="divide-y">{exercises.map(ex => (
          <button key={ex.id} onClick={() => toggle(ex.id)} className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 ${ex.done ? 'bg-emerald-50' : ''}`}>
            <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${ex.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>{ex.done && <Check size={18} />}</div>
            <span className={`font-medium flex-1 ${ex.done ? 'text-emerald-700 line-through' : ''}`}>{ex.name}</span>
          </button>
        ))}</div>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border outline-none resize-none" placeholder="Session notes..." />
      <button onClick={async () => { setCompleting(true); await onComplete(session.id, notes, exercises.filter(e=>e.done).map(e=>e.name)); setCompleting(false); }} disabled={completing} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
        {completing ? 'Completing...' : <><CheckCircle size={22} /> Complete Session ({doneCount}/{exercises.length})</>}
      </button>
    </div>
  );
};

// === CLIENTS VIEW ===
const ClientsView = ({ showToast }) => {
  const [clients, setClients] = useState([]); const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false); const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => { setLoading(true); try { const r = await api.getClients(); if (r.success) setClients(r.clients||[]); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const filtered = clients.filter(c => (c.name||'').toLowerCase().includes(search.toLowerCase()) || (c.email||'').includes(search) || (c.phone||'').includes(search));

  const handleAdd = async (d) => { try { await api.createClient(d); showToast('Client added!'); setShowAdd(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleImport = async (d) => { try { const r = await api.bulkImportClients({ clients: d }); showToast(r.message); setShowImport(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.deleteClient(deleteTarget.id); showToast('Client deleted'); setDeleteTarget(null); load(); } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Clients ({clients.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium"><Upload size={16} /> Import CSV</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> Add Client</button>
        </div>
      </div>
      <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none" placeholder="Search..." /></div>
      {loading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
       filtered.length === 0 ? <EmptyState icon={Users} title="No clients" subtitle="Add or import clients" /> :
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th><th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Contact</th><th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Joined</th><th className="px-6 py-3 w-20"></th></tr></thead>
        <tbody className="divide-y">{filtered.map(c => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-6 py-4 cursor-pointer" onClick={() => setSelected(c)}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold">{(c.name||'?')[0]}</div><span className="font-semibold">{c.name}</span></div></td>
            <td className="px-6 py-4 text-sm text-slate-500">{c.phone || c.email || '-'}</td>
            <td className="px-6 py-4 text-sm text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
            <td className="px-6 py-4"><button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></td>
          </tr>
        ))}</tbody></table>
      </div>}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Client" size="sm">
        {(() => { const F = () => { const [f,sF]=useState({name:'',email:'',phone:''}); const [l,sL]=useState(false); return (<form onSubmit={async e => { e.preventDefault(); sL(true); await handleAdd(f); sL(false); }} className="space-y-4"><div><label className="block text-sm font-medium mb-1">Name *</label><input required value={f.name} onChange={e=>sF({...f,name:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={f.email} onChange={e=>sF({...f,email:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div><div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={f.phone} onChange={e=>sF({...f,phone:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="+91..." /></div></div><button type="submit" disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Adding...':'Add Client'}</button></form>); }; return <F />; })()}
      </Modal>
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Clients" size="md"><BulkImportForm type="clients" onSubmit={handleImport} columns={['name','email','phone','age','gender','goal']} sampleRow="John Doe,john@email.com,+919876543210,28,male,weight loss" /></Modal>
      {selected && <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected.name} size="md"><div className="space-y-4"><div className="grid grid-cols-2 gap-4 text-sm">{selected.email&&<div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Email</div><div className="font-medium">{selected.email}</div></div>}{selected.phone&&<div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">Phone</div><div className="font-medium">{selected.phone}</div></div>}</div></div></Modal>}
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Client" message={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`} />
    </div>
  );
};

// === WORKOUTS VIEW ===
const WorkoutsView = ({ showToast }) => {
  const [workouts, setWorkouts] = useState([]); const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false); const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState('all'); const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => { setLoading(true); try { const r = await api.getWorkouts(filter === 'all' ? null : filter); if (r.success) setWorkouts(r.workouts||[]); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [filter]);
  const handleAdd = async (d) => { try { await api.createWorkout(d); showToast('Workout added!'); setShowAdd(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleImport = async (d) => { try { const r = await api.bulkImportWorkouts({ workouts: d }); showToast(r.message); setShowImport(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleDelete = async () => { if (!deleteTarget) return; try { await api.deleteWorkout(deleteTarget.id); showToast('Workout deleted'); setDeleteTarget(null); load(); } catch (e) { showToast(e.message, 'error'); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Workout Library ({workouts.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium"><Upload size={16} /> Import CSV</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> Add Workout</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">{['all','strength','cardio','hiit','yoga','pilates','gym'].map(c => <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${filter===c?'bg-blue-600 text-white':'bg-white border hover:bg-slate-50'}`}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>)}</div>
      {loading ? <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
       workouts.length === 0 ? <EmptyState icon={Dumbbell} title="No workouts" subtitle="Add or import" /> :
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{workouts.map(w => (
        <div key={w.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-3"><span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">{w.category}</span>
            <button onClick={() => setDeleteTarget(w)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button></div>
          <h3 className="font-bold text-lg mb-1">{w.name}</h3><p className="text-sm text-slate-500 line-clamp-2">{w.description || 'No description'}</p>
          {w.duration_minutes && <p className="text-xs text-slate-400 mt-2">{w.duration_minutes} min</p>}
        </div>
      ))}</div>}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Workout" size="sm">
        {(() => { const F = () => { const [f,sF]=useState({name:'',description:'',category:'strength',duration_minutes:30}); const [l,sL]=useState(false); return (<form onSubmit={async e => { e.preventDefault(); sL(true); await handleAdd(f); sL(false); }} className="space-y-4"><div><label className="block text-sm font-medium mb-1">Name *</label><input required value={f.name} onChange={e=>sF({...f,name:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div><div><label className="block text-sm font-medium mb-1">Description</label><textarea value={f.description} onChange={e=>sF({...f,description:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" rows={2} /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1">Category</label><select value={f.category} onChange={e=>sF({...f,category:e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none">{['strength','cardio','hiit','yoga','pilates','gym'].map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Duration (min)</label><input type="number" value={f.duration_minutes} onChange={e=>sF({...f,duration_minutes:parseInt(e.target.value)||30})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div></div><button type="submit" disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Adding...':'Add Workout'}</button></form>); }; return <F />; })()}
      </Modal>
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Workouts" size="md"><BulkImportForm type="workouts" onSubmit={handleImport} columns={['name','description','category','duration_minutes']} sampleRow="Bench Press,Flat barbell press,strength,15" /></Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Workout" message={`Delete "${deleteTarget?.name}"?`} />
    </div>
  );
};

// === SCHEDULE PLANNER ===
const ScheduleView = ({ showToast }) => {
  const [clients, setClients] = useState([]); const [workouts, setWorkouts] = useState([]); const [sessions, setSessions] = useState([]);
  const [showPlan, setShowPlan] = useState(false); const [showBulk, setShowBulk] = useState(false); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const [c,w,s] = await Promise.all([api.getClients(),api.getWorkouts(),api.getSessions()]); if(c.success) setClients(c.clients||[]); if(w.success) setWorkouts(w.workouts||[]); if(s.success) setSessions(s.sessions||[]); setLoading(false); };
  useEffect(() => { load(); }, []);
  const grouped = {}; sessions.forEach(s => { const d = new Date(s.scheduled_at).toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'}); if(!grouped[d]) grouped[d]=[]; grouped[d].push(s); });
  const handlePlan = async (d) => {
    try { if (d.recurrence_type && d.recurrence_type !== 'once') { const [dt,tm] = d.scheduled_at.split('T'); await api.createRecurringSessions({client_id:d.client_id,recurrence_type:d.recurrence_type,start_date:dt,time:tm||'09:00',num_sessions:d.num_sessions||4,duration_minutes:d.duration_minutes,location:d.location}); } else { await api.createSession(d); } showToast('Scheduled!'); setShowPlan(false); load(); } catch (e) { showToast(e.message, 'error'); }
  };
  const handleBulk = async (rows) => { try { const r = await api.bulkPlanSessions({sessions:rows}); showToast(r.message); setShowBulk(false); load(); } catch (e) { showToast(e.message, 'error'); } };
  const handleDeleteSession = async (id) => { if (!confirm('Delete session?')) return; try { await api.deleteSession(id); showToast('Deleted'); load(); } catch(e) { showToast(e.message, 'error'); } };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Schedule Planner ({sessions.length})</h1>
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
            <div key={s.id} className="bg-white border rounded-xl p-4 flex items-center justify-between hover:shadow-sm group">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{(s.client_name||'?')[0]}</div><div><span className="font-semibold">{s.client_name}</span><span className="text-sm text-slate-400 ml-2">{new Date(s.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>{s.template_name&&<span className="text-sm text-indigo-500 ml-2">{s.template_name}</span>}</div></div>
              <div className="flex items-center gap-2"><StatusBadge status={s.status} /><button onClick={() => handleDeleteSession(s.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button></div>
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
      <Modal isOpen={showBulk} onClose={() => setShowBulk(false)} title="Bulk Plan" size="lg">
        {(() => { const F = () => { const [rows,sR]=useState([{client_id:'',scheduled_at:'',workout_id:'',duration_minutes:60}]); const [l,sL]=useState(false);
          const add=()=>sR([...rows,{client_id:'',scheduled_at:'',workout_id:'',duration_minutes:60}]);
          const upd=(i,k,v)=>{const n=[...rows];n[i][k]=v;sR(n);}; const rm=(i)=>sR(rows.filter((_,idx)=>idx!==i));
          return (<div className="space-y-4"><div className="space-y-3 max-h-80 overflow-y-auto">{rows.map((r,i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">{i===0&&<label className="text-xs font-medium">Client</label>}<select value={r.client_id} onChange={e=>upd(i,'client_id',e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm"><option value="">Select...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-span-3">{i===0&&<label className="text-xs font-medium">Date & Time</label>}<input type="datetime-local" value={r.scheduled_at} onChange={e=>upd(i,'scheduled_at',e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div className="col-span-3">{i===0&&<label className="text-xs font-medium">Workout</label>}<select value={r.workout_id} onChange={e=>upd(i,'workout_id',e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm"><option value="">None</option>{workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
              <div className="col-span-1">{i===0&&<label className="text-xs font-medium">Min</label>}<input type="number" value={r.duration_minutes} onChange={e=>upd(i,'duration_minutes',parseInt(e.target.value)||60)} className="w-full px-2 py-2 rounded-lg border text-sm" /></div>
              <div className="col-span-1">{rows.length>1&&<button onClick={()=>rm(i)} className="p-2 text-red-400 hover:text-red-600"><X size={16}/></button>}</div>
            </div>))}</div>
            <button onClick={add} className="w-full py-2 border-2 border-dashed rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50">+ Add row</button>
            <button onClick={async()=>{const v=rows.filter(r=>r.client_id&&r.scheduled_at); if(!v.length) return; sL(true); await handleBulk(v); sL(false);}} disabled={l} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{l?'Planning...':`Plan ${rows.filter(r=>r.client_id&&r.scheduled_at).length} Session(s)`}</button>
          </div>); }; return <F />; })()}
      </Modal>
    </div>
  );
};

// === PAYMENTS VIEW ===
const PaymentsView = ({ showToast }) => {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ client_id: '', amount: '', description: 'Coaching session payment' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { api.getClients().then(r => r.success && setClients(r.clients||[])); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.amount) return;
    setLoading(true);
    try {
      const r = await api.createPaymentLink({ client_id: form.client_id, amount: parseFloat(form.amount), description: form.description });
      if (r.success) { setResult(r); showToast(`Payment link created for ₹${r.amount}`); }
    } catch (e) { showToast(e.message, 'error'); }
    setLoading(false);
  };

  const copyLink = () => { if (result?.payment_link) { navigator.clipboard.writeText(result.payment_link); showToast('Link copied!'); } };
  const shareWhatsApp = () => {
    if (!result) return;
    const client = clients.find(c => c.id === form.client_id);
    const phone = (client?.phone || '').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Hi ${result.client_name}, here is your payment link for ₹${result.amount}: ${result.payment_link}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };
  const shareEmail = () => {
    if (!result) return;
    const client = clients.find(c => c.id === form.client_id);
    const subject = encodeURIComponent('Payment Link - FitLife Coaching');
    const body = encodeURIComponent(`Hi ${result.client_name},\n\nHere is your payment link for ₹${result.amount}:\n${result.payment_link}\n\nThank you!`);
    window.open(`mailto:${client?.email || ''}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold text-lg mb-4">Create Payment Link (Razorpay)</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Client *</label>
            <select required value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="">Select client...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Amount (₹) *</label>
              <input required type="number" min="1" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="1000" /></div>
            <div><label className="block text-sm font-medium mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" /></div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Creating...' : <><DollarSign size={18} /> Create Payment Link</>}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle size={20} /> <span className="font-bold">Payment link created for {result.client_name} — ₹{result.amount}</span></div>
          {result.mode === 'demo' && <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Demo mode — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Azure env vars for real links</p>}
          <div className="flex items-center gap-2 bg-white rounded-xl p-3 border">
            <input readOnly value={result.payment_link} className="flex-1 text-sm font-mono outline-none" />
            <button onClick={copyLink} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-medium flex items-center gap-1"><Copy size={14} /> Copy</button>
          </div>
          <div className="flex gap-3">
            <button onClick={shareWhatsApp} className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600"><MessageCircle size={18} /> Send via WhatsApp</button>
            <button onClick={shareEmail} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600"><Mail size={18} /> Send via Email</button>
          </div>
        </div>
      )}
    </div>
  );
};

// === PROGRESS VIEW ===
const ProgressView = ({ showToast }) => {
  const [clients, setClients] = useState([]); const [sel, setSel] = useState(''); const [weight, setWeight] = useState(''); const [notes, setNotes] = useState(''); const [loading, setLoading] = useState(false);
  const [progressDate, setProgressDate] = useState(new Date().toISOString().split('T')[0]);
  useEffect(() => { api.getClients().then(r => r.success && setClients(r.clients||[])); }, []);
  const handle = async () => { if (!sel) { showToast('Select client', 'error'); return; } setLoading(true); try { await api.uploadProgress({ client_id: sel, type: 'measurement', weight: weight ? parseFloat(weight) : null, notes, date: progressDate, measurements: {}, photos: [] }); showToast('Progress recorded!'); setWeight(''); setNotes(''); } catch (e) { showToast(e.message, 'error'); } setLoading(false); };
  return (
    <div className="space-y-6"><h1 className="text-2xl font-bold">Client Progress</h1>
      <div className="bg-white rounded-2xl border p-6 space-y-4"><h3 className="font-bold text-lg">Record Progress</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Client *</label><select value={sel} onChange={e=>setSel(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none"><option value="">Select...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="block text-sm font-medium mb-1">Date *</label><input type="date" value={progressDate} onChange={e => setProgressDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Weight (kg)</label><input type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="72.5" /></div><div><label className="block text-sm font-medium mb-1">Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none" placeholder="Progress notes..." /></div></div>
        <div className="bg-slate-50 border-2 border-dashed rounded-xl p-8 text-center"><Camera size={32} className="mx-auto text-slate-400 mb-2" /><p className="text-sm text-slate-500">Photo upload coming soon</p></div>
        <button onClick={handle} disabled={loading||!sel} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">{loading?'Saving...':'Save Progress'}</button>
      </div>
    </div>
  );
};



// === AI PROMPT VIEW ===
const PromptView = ({ showToast }) => {
  const WELCOME = "Hello! I'm your AI coaching assistant. I can help you manage your entire business.\n\nJust tell me what you need — I'll ask for any missing details.\n\n**Examples:**\n• \"I want to add a new client\"\n• \"Add 5 clients at once\"\n• \"Create a workout called Leg Day\"\n• \"Schedule Rahul for daily sessions\"\n• \"Mark Rahul present\"\n• \"Show my dashboard\"";

  const [messages, setMessages] = useState([{ role: 'ai', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState(null);
  const [ctx, setCtx] = useState({ lastClient: null, lastWorkout: null });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const findClient = async (name) => { const r=await api.getClients();const n=name.toLowerCase().trim();return(r.clients||[]).find(c=>c.name.toLowerCase()===n)||(r.clients||[]).find(c=>c.name.toLowerCase().includes(n)); };
  const findWorkout = async (name) => { const r=await api.getWorkouts();const n=name.toLowerCase().trim();return(r.workouts||[]).find(w=>w.name.toLowerCase()===n)||(r.workouts||[]).find(w=>w.name.toLowerCase().includes(n)); };
  const parseDate = (text) => {
    const dt=new Date();const t=text.toLowerCase();
    if(t.includes('tomorrow'))dt.setDate(dt.getDate()+1);
    else if(t.match(/(mon|tue|wed|thu|fri|sat|sun)/i)){const days=['sun','mon','tue','wed','thu','fri','sat'];const tgt=days.findIndex(d=>t.includes(d));if(tgt>=0){do{dt.setDate(dt.getDate()+1)}while(dt.getDay()!==tgt);}}
    else{const m=text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);if(m){dt.setDate(parseInt(m[2]));dt.setMonth(parseInt(m[1])-1);}}
    const tm=text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if(tm){let h=parseInt(tm[1]);if(tm[3].toLowerCase()==='pm'&&h<12)h+=12;if(tm[3].toLowerCase()==='am'&&h===12)h=0;dt.setHours(h,parseInt(tm[2]||'0'),0,0);}else dt.setHours(10,0,0,0);
    return dt;
  };
  const fmtD=(dt)=>dt.toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'})+' at '+dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  // ===== FLOW ENGINE =====
  const processFlow = async (userInput) => {
    const f=flow;const p=userInput.trim();const pl=p.toLowerCase();
    // ADD CLIENT
    if(f.type==='add_client'){
      if(!f.name){setFlow({...f,name:p});return{text:`Got it — **${p}**.\n\n📱 What's their **phone number**?`};}
      if(!f.phone){const ph=p.replace(/[^+\d]/g,'');if(ph.length<10)return{text:'Please enter a valid 10+ digit phone number:'};setFlow({...f,phone:ph});return{text:`Phone: ${ph}\n\n📧 **Email?** (type "skip" to skip)`};}
      if(f.email===undefined){const em=pl==='skip'||pl==='no'?'':p;if(em&&!em.includes('@')&&pl!=='skip')return{text:'Enter a valid email or type **skip**:'};
        try{const r=await api.createClient({name:f.name,phone:f.phone,email:em||null});setCtx(v=>({...v,lastClient:r.client}));setFlow(null);return{text:`✅ **${f.name}** added!\n📱 ${f.phone}${em?'\n📧 '+em:''}\n\nWhat's next? Schedule a session for them?`,actions:[{label:'Clients',tab:'clients'}]};}catch(e){setFlow(null);return{text:`❌ ${e.message}`};}
      }
    }
    // BULK CLIENTS
    if(f.type==='bulk_clients'){
      if(!f.count){const n=parseInt(p);if(!n||n<1||n>50)return{text:'Enter a number between 1-50:'};setFlow({...f,count:n,clients:[],idx:0});return{text:`Adding **${n} clients**.\n\n👤 **Name** for client 1:`};}
      const c=f.clients;const idx=f.idx;
      if(c.length===idx){c.push({name:p});setFlow({...f,clients:c});return{text:`📱 **Phone** for ${p}:`};}
      if(!c[idx].phone){const ph=p.replace(/[^+\d]/g,'');if(ph.length<10)return{text:`Invalid. Enter 10+ digits for **${c[idx].name}**:`};c[idx].phone=ph;const next=idx+1;setFlow({...f,clients:c,idx:next});
        if(next>=f.count){try{const r=await api.bulkImportClients({clients:c});setFlow(null);return{text:`✅ ${r.message}!\n\n${c.map((cl,i)=>`${i+1}. **${cl.name}** — ${cl.phone}`).join('\n')}`,actions:[{label:'Clients',tab:'clients'}]};}catch(e){setFlow(null);return{text:`❌ ${e.message}`};}}
        return{text:`✅ Got it!\n\n👤 **Name** for client ${next+1} of ${f.count}:`};}
    }
    // ADD WORKOUT
    if(f.type==='add_workout'){
      if(!f.name){setFlow({...f,name:p});return{text:`Workout: **${p}**\n\n📂 **Category?** (strength, cardio, hiit, yoga, pilates, general)`};}
      if(!f.category){const cats=['strength','cardio','hiit','yoga','pilates','general','education','music'];const cat=cats.find(c=>pl.includes(c))||'strength';setFlow({...f,category:cat});return{text:`Category: **${cat}**\n\n⏱️ **Duration in minutes?** (30, 45, 60)`};}
      if(!f.duration){const dur=parseInt(p);if(!dur||dur<5)return{text:'Enter valid minutes (5+):'};setFlow({...f,duration:dur});return{text:`Duration: **${dur}min**\n\n🏷️ **Assign to client?** (name or "skip")`};}
      if(f.assignDone===undefined){let extra='';let clId=null;
        if(pl!=='skip'&&pl!=='no'&&pl!=='none'){const cl=await findClient(p);if(!cl)return{text:`"${p}" not found. Enter exact name or **skip**:`};clId=cl.id;extra=`\n📌 Assigned to **${cl.name}** tomorrow 10 AM!`;}
        try{const r=await api.createWorkout({name:f.name,category:f.category,duration_minutes:f.duration});setCtx(v=>({...v,lastWorkout:r.workout}));
          if(clId){const d=new Date();d.setDate(d.getDate()+1);d.setHours(10,0,0,0);await api.createSession({client_id:clId,scheduled_at:d.toISOString().slice(0,16),duration_minutes:f.duration,workout_id:r.workout.id});}
          setFlow(null);return{text:`✅ **${f.name}** created!\n📂 ${f.category} | ⏱️ ${f.duration}min${extra}`,actions:[{label:'Workouts',tab:'workouts'}]};}catch(e){setFlow(null);return{text:`❌ ${e.message}`};}
      }
    }
    // SCHEDULE
    if(f.type==='schedule'){
      if(!f.clientName){const cl=await findClient(p);if(!cl){const all=await api.getClients();return{text:`"${p}" not found.\nClients: ${(all.clients||[]).slice(0,10).map(c=>c.name).join(', ')||'none'}`};}setFlow({...f,clientName:cl.name,clientId:cl.id});setCtx(v=>({...v,lastClient:cl}));return{text:`**${cl.name}** selected.\n\n🔄 **How often?**\n• once\n• daily\n• daily (weekdays only)\n• weekly\n• biweekly`};}
      if(!f.rec){let rec='once';if(pl.includes('daily')&&(pl.includes('weekday')||pl.includes('no week')||pl.includes('skip week')))rec='daily';else if(pl.includes('daily'))rec='daily';else if(pl.includes('weekly'))rec='weekly';else if(pl.includes('biweekly'))rec='biweekly';
        setFlow({...f,rec});if(rec!=='once')return{text:`**${rec}** schedule.\n\n🔢 **How many sessions?**`};return{text:`Single session.\n\n📅 **When?** (e.g. "tomorrow at 10am")`};}
      if(f.rec!=='once'&&!f.num){const n=parseInt(p);if(!n)return{text:'Enter number of sessions:'};setFlow({...f,num:n});return{text:`**${n} sessions**.\n\n📅 **Start date & time?** (e.g. "Monday at 10am")`};}
      if(!f.dt){const dt=parseDate(p);if(!p.match(/\d{1,2}\s*(am|pm)/i))return{text:'Include a time. E.g. "tomorrow at 10am":'};setFlow({...f,dt});return{text:`📅 ${fmtD(dt)}\n\n⏱️ **Duration per session?** (minutes)`};}
      if(!f.dur){const dur=parseInt(p)||60;setFlow({...f,dur});return{text:`**${dur}min** per session.\n\n🏋️ **Attach workout?** (name or "skip")`};}
      if(f.wkDone===undefined){let wkId=null,wkN='';if(pl!=='skip'&&pl!=='no'&&pl!=='none'){const wk=await findWorkout(p);if(!wk)return{text:`"${p}" not found. Enter exact name or **skip**:`};wkId=wk.id;wkN=wk.name;}
        try{if(f.rec==='once'){await api.createSession({client_id:f.clientId,scheduled_at:f.dt.toISOString().slice(0,16),duration_minutes:f.dur,workout_id:wkId});setFlow(null);return{text:`✅ Session booked!\n📅 **${f.clientName}** — ${fmtD(f.dt)}\n⏱️ ${f.dur}min${wkN?'\n🏋️ '+wkN:''}`,actions:[{label:'Schedule',tab:'schedule'}]};}
          else{const r=await api.createRecurringSessions({client_id:f.clientId,recurrence_type:f.rec,start_date:f.dt.toISOString().slice(0,10),time:f.dt.toTimeString().slice(0,5),num_sessions:f.num,duration_minutes:f.dur});setFlow(null);return{text:`✅ ${r.message}!\n📅 **${f.clientName}** — ${f.rec} from ${fmtD(f.dt)}\n⏱️ ${f.dur}min${wkN?'\n🏋️ '+wkN:''}`,actions:[{label:'Schedule',tab:'schedule'}]};}
        }catch(e){setFlow(null);return{text:`❌ ${e.message}`};}
      }
    }
    // ATTENDANCE
    if(f.type==='attendance'){
      if(!f.clientName){const cl=await findClient(p);if(!cl)return{text:`"${p}" not found. Enter exact name:`};setFlow({...f,clientName:cl.name,clientId:cl.id});return{text:`**${cl.name}** — mark as:\n✅ **present** or ❌ **absent**`};}
      if(!f.status){const st=pl.includes('absent')||pl.includes('no')?'absent':'attended';const today=await api.getTodaySchedule();const sess=(today.sessions||[]).find(s=>s.client_id===f.clientId&&(s.status==='scheduled'||s.status==='confirmed'));
        if(!sess){const any=(today.sessions||[]).find(s=>s.client_id===f.clientId);setFlow(null);return any?{text:`⚠️ ${f.clientName} already **${any.status}**.`}:{text:`❌ No session for **${f.clientName}** today.`};}
        await api.markAttendance(sess.id,st);setFlow(null);return{text:`✅ **${f.clientName}** — **${st==='attended'?'Present ✓':'Absent ✗'}**`,actions:[{label:'Today',tab:'today'}]};}
    }
    // CONFIRM DELETE
    if(f.type==='confirm_del'){if(pl==='yes'||pl==='y'||pl==='ok'||pl==='confirm'){try{if(f.ent==='client')await api.deleteClient(f.id);else if(f.ent==='workout')await api.deleteWorkout(f.id);setFlow(null);return{text:`✅ **${f.name}** deleted.`};}catch(e){setFlow(null);return{text:`❌ ${e.message}`};}}setFlow(null);return{text:'Cancelled.'};}
    return null;
  };

  // ===== INTENT ROUTER =====
  const processIntent = async (userInput) => {
    const p=userInput.trim();const pl=p.toLowerCase();
    // ADD CLIENT
    if(pl.match(/(?:add|create|new|register)\s+(?:a\s+)?(?:new\s+)?client/i)||pl.match(/^i\s+want\s+to\s+add/i)){
      const inline=pl.replace(/(?:add|create|new|register)\s+(?:a\s+)?(?:new\s+)?client\s*(?:named?\s+)?/i,'');
      if(inline.length>2){const ph=inline.match(/(\+?\d[\d\s-]{8,})/);const em=inline.match(/(\S+@\S+\.\S+)/);let nm=inline.replace(/(\+?\d[\d\s-]{8,})/g,'').replace(/\S+@\S+\.\S+/g,'').replace(/,?\s*(phone|mobile|email|ph)[:\s]*/gi,'').replace(/[,]/g,' ').trim();
        if(nm&&ph){try{const r=await api.createClient({name:nm,phone:ph[1].replace(/[\s-]/g,''),email:em?.[1]||null});setCtx(v=>({...v,lastClient:r.client}));return{text:`✅ **${nm}** added! 📱 ${ph[1]}${em?'\n📧 '+em[1]:''}`,actions:[{label:'Clients',tab:'clients'}]};}catch(e){return{text:`❌ ${e.message}`};}}
        if(nm){setFlow({type:'add_client',name:nm});return{text:`Adding **${nm}**.\n\n📱 **Phone number?**`};}
      }
      setFlow({type:'add_client'});return{text:"Let's add a client!\n\n👤 **What's their name?**"};
    }
    // BULK CLIENTS
    if(pl.match(/(?:add|create|import)\s+(?:\d+\s+)?(?:multiple|bulk|many|several)\s*client/i)||pl.match(/bulk\s+(?:add|import)/i)||pl.match(/add\s+(\d+)\s+client/i)){
      const colon=p.split(/:\s*/)[1];if(colon){const entries=colon.split(/[,;\n]+/).map(e=>e.trim()).filter(Boolean);if(entries.length>=2){const cls=entries.map(e=>{const ph=e.match(/(\d{10,})/);return{name:e.replace(/\d{10,}/g,'').trim()||'Unknown',phone:ph?.[1]};});try{const r=await api.bulkImportClients({clients:cls});return{text:`✅ ${r.message}!\n\n${cls.map((c,i)=>`${i+1}. **${c.name}**${c.phone?' — '+c.phone:''}`).join('\n')}`,actions:[{label:'Clients',tab:'clients'}]};}catch(e){return{text:`❌ ${e.message}`};}}}
      const nm=pl.match(/(\d+)\s*client/);setFlow({type:'bulk_clients',count:nm?parseInt(nm[1]):null});return nm?{text:`Adding **${nm[1]} clients**.\n\n👤 **Name** for client 1:`}:{text:'How many clients to add?'};
    }
    // ADD WORKOUT
    if(pl.match(/(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?workout/i)){
      const inline=pl.replace(/(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?workout\s*(?:called|named)?\s*/i,'');
      if(inline.length>2){const nm=(inline.match(/^(.+?)(?:,|\s+(?:cat|type|dur|\d+\s*min|for\s))/i)||[null,inline.split(',')[0]])[1].trim().replace(/["']/g,'');
        if(nm){setFlow({type:'add_workout',name:nm});return{text:`Workout: **${nm}**\n\n📂 **Category?** (strength, cardio, hiit, yoga, general)`};}}
      setFlow({type:'add_workout'});return{text:"Let's create a workout!\n\n🏋️ **What's the name?**"};
    }
    // SCHEDULE
    if(pl.match(/(?:schedule|book|plan|set)\s+/i)){
      if(pl.match(/(?:them|him|her)/i)&&ctx.lastClient){setFlow({type:'schedule',clientName:ctx.lastClient.name,clientId:ctx.lastClient.id});return{text:`Scheduling **${ctx.lastClient.name}**.\n\n🔄 **How often?** (once/daily/weekly/biweekly)`};}
      const allCl=await api.getClients();let cl=null;for(const c of(allCl.clients||[])){if(pl.includes(c.name.toLowerCase())){cl=c;break;}}
      if(cl){setFlow({type:'schedule',clientName:cl.name,clientId:cl.id});setCtx(v=>({...v,lastClient:cl}));return{text:`Scheduling **${cl.name}**.\n\n🔄 **How often?** (once/daily/weekdays only/weekly/biweekly)`};}
      setFlow({type:'schedule'});return{text:"Let's schedule a session!\n\n👤 **Which client?**"};
    }
    // MARK ATTENDANCE
    if(pl.match(/mark\s+/i)&&pl.match(/(present|absent|attend|no.?show)/i)){const m=pl.match(/mark\s+(.+?)\s+(?:as\s+)?(?:present|absent)/i);if(m){const cl=await findClient(m[1].trim());if(cl){const st=pl.includes('absent')?'absent':'attended';const td=await api.getTodaySchedule();const sess=(td.sessions||[]).find(s=>s.client_id===cl.id&&(s.status==='scheduled'||s.status==='confirmed'));if(!sess)return{text:`❌ No session for **${cl.name}** today.`};await api.markAttendance(sess.id,st);return{text:`✅ **${cl.name}** — **${st==='attended'?'Present ✓':'Absent ✗'}**`,actions:[{label:'Today',tab:'today'}]};}}setFlow({type:'attendance'});return{text:'👤 **Which client?**'};}
    if(pl.match(/(?:mark|take|record)\s*(?:attendance)/i)){setFlow({type:'attendance'});return{text:'👤 **Which client?**'};}
    // DELETE
    if(pl.match(/(?:delete|remove)\s+(?:the\s+)?client\s+/i)){const nm=pl.replace(/(?:delete|remove)\s+(?:the\s+)?client\s+(?:named?\s+)?/i,'').trim();const cl=await findClient(nm);if(!cl)return{text:`❌ "${nm}" not found.`};setFlow({type:'confirm_del',ent:'client',id:cl.id,name:cl.name});return{text:`⚠️ Delete **${cl.name}**? Type **yes** or **no**.`};}
    if(pl.match(/(?:delete|remove)\s+(?:the\s+)?workout/i)){const nm=pl.replace(/(?:delete|remove)\s+(?:the\s+)?workout\s*(?:called|named)?\s*/i,'').trim();const wk=await findWorkout(nm);if(!wk)return{text:`❌ "${nm}" not found.`};setFlow({type:'confirm_del',ent:'workout',id:wk.id,name:wk.name});return{text:`⚠️ Delete **${wk.name}**? Type **yes** or **no**.`};}
    // SHOW/LIST
    if(pl.match(/(?:show|list|get|view|all|my)\s*(?:my\s+)?client/i)||pl==='clients'){const r=await api.getClients();const cl=r.clients||[];if(!cl.length)return{text:'No clients yet. Say **"add a client"**!'};return{text:`📋 **Clients (${cl.length}):**\n\n${cl.slice(0,20).map((c,i)=>`${i+1}. **${c.name}**${c.phone?' — '+c.phone:''}`).join('\n')}`,actions:[{label:'Clients',tab:'clients'}]};}
    if(pl.match(/(?:show|list|get|view|all|my)\s*(?:my\s+)?workout/i)||pl==='workouts'){const r=await api.getWorkouts();const wk=r.workouts||[];if(!wk.length)return{text:'No workouts. Say **"create a workout"**!'};return{text:`🏋️ **Workouts (${wk.length}):**\n\n${wk.map((w,i)=>`${i+1}. **${w.name}** (${w.category||'-'}) ${w.duration_minutes||30}min`).join('\n')}`,actions:[{label:'Workouts',tab:'workouts'}]};}
    if(pl.match(/(?:show|what|today|my)\s*(?:'s|is)?\s*(?:my\s+)?(?:today|schedule|session)/i)||pl==='today'){const r=await api.getTodaySchedule();const s=r.sessions||[];if(!s.length)return{text:'No sessions today.',actions:[{label:'Plan',tab:'schedule'}]};const ic={scheduled:'⏳',confirmed:'✅',completed:'✅',cancelled:'❌',no_show:'❌',in_progress:'▶️'};return{text:`📅 **Today (${s.length}):**\n\n${s.map(x=>`${ic[x.status]||'⏳'} ${new Date(x.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} — **${x.client_name}** ${x.workout_name?'('+x.workout_name+')':''} [${x.status}]`).join('\n')}\n\n💡 "mark [name] present" for attendance`,actions:[{label:'Today',tab:'today'}]};}
    // REMINDERS
    if(pl.match(/(?:send|trigger)\s+(?:a\s+)?(?:whatsapp|wa|email|reminder)/i)){const nm=(pl.match(/(?:to|for)\s+(.+?)$/i)||[])[1];if(!nm)return{text:'Who to? "send reminder to Rahul"'};const cl=await findClient(nm.trim());if(!cl)return{text:`❌ "${nm}" not found.`};const mt=pl.includes('email')?'email':'whatsapp';const r=await api.sendPersonalReminder({client_id:cl.id,method:mt});if(r.success&&r.link){window.open(r.link,'_blank');return{text:`✅ ${mt==='whatsapp'?'WhatsApp':'Email'} for **${cl.name}**!`};}return{text:`❌ ${r.message||'Failed'}`};}
    // PAYMENT
    if(pl.match(/(?:create|send|make)\s+(?:a\s+)?payment/i)){const amt=(p.match(/(\d[\d,]*)/)||[])[1];const cR=await api.getClients();let cl=null;for(const c of(cR.clients||[])){if(pl.includes(c.name.toLowerCase())){cl=c;break;}}if(!cl)cl=ctx.lastClient;if(!cl)return{text:'Which client? "payment for Rahul 2000"'};if(!amt)return{text:`Amount for **${cl.name}**?`};const a=parseInt(amt.replace(/,/g,''));const r=await api.createPaymentLink({client_id:cl.id,amount:a});return r.success?{text:`✅ **${cl.name}** — ₹${a.toLocaleString()}\n🔗 ${r.payment_link}`,actions:[{label:'Payments',tab:'payments'}]}:{text:'❌ Failed'};}
    // STATS
    if(pl.match(/(?:show|get|my)\s*(?:stats|dashboard|overview|summary)/i)||pl==='stats'||pl==='dashboard'){const r=await api.getDashboardStats();const s=r.stats||{};return{text:`📊 **Dashboard**\n\n👥 Clients: **${s.total_clients||0}**\n📅 Sessions: **${s.total_sessions||0}**\n✅ Completed: **${s.completed_sessions||0}**\n🏋️ Workouts: **${s.total_workouts||0}**`,actions:[{label:'Dashboard',tab:'dashboard'}]};}
    // LEADS
    if(pl.match(/(?:show|get|check|view|my|new)\s*(?:leads?|interest|callback|inbox|requests?)/i)||pl==='leads'){const r=await api.getLeads();const leads=r.leads||[];if(!leads.length)return{text:'📥 No leads yet. When clients express interest on your CoachMe.life profile, they\'ll appear here.',actions:[{label:'Leads',tab:'leads'}]};const newCount=leads.filter(l=>l.status==='new').length;return{text:`📥 **Leads (${leads.length} total, ${newCount} new):**\n\n${leads.slice(0,10).map((l,i)=>`${i+1}. ${l.status==='new'?'🔴':'⚪'} **${l.name}** (${l.lead_type}) — ${l.phone||l.email||'no contact'}${l.message?'\n   "'+l.message.slice(0,60)+'"':''}`).join('\n')}${leads.length>10?'\n...+'+(leads.length-10)+' more':''}`,actions:[{label:'View All Leads',tab:'leads'}]};}
    // HELP
    if(pl.match(/^(?:help|what can|commands|how)/i))return{text:"**I can help with:**\n\n👥 **\"Add a client\"** — step-by-step guided\n👥 **\"Add 5 clients\"** — bulk add with prompts\n🏋️ **\"Create a workout\"** — guided creation\n📅 **\"Schedule a session\"** — walks through all options\n✅ **\"Mark Rahul present\"** — attendance\n📱 **\"Send WhatsApp to Rahul\"** — reminders\n💰 **\"Payment for Rahul 2000\"** — payment links\n📊 **\"Show my stats\"** — dashboard\n🗑️ **\"Delete client/workout [name]\"**\n\n💡 After adding someone, say \"schedule them\" — I remember context!"};
    // FALLBACK
    return{text:"I can help you:\n• **\"Add a client\"** — guided step-by-step\n• **\"Create a workout\"**\n• **\"Schedule a session\"**\n• **\"Mark [name] present\"**\n• **\"Show my clients/stats\"**\n\nType **help** for full list."};
  };

  const handleSubmit = async(e)=>{e.preventDefault();if(!input.trim()||loading)return;const msg=input.trim();setInput('');setMessages(prev=>[...prev,{role:'user',text:msg}]);setLoading(true);try{let r=null;if(flow)r=await processFlow(msg);if(!r)r=await processIntent(msg);setMessages(prev=>[...prev,{role:'ai',...r}]);}catch(err){setMessages(prev=>[...prev,{role:'ai',text:`❌ ${err.message}`}]);}setLoading(false);inputRef.current?.focus();};
  const handleAction=(a)=>{if(a.tab)window.dispatchEvent(new CustomEvent('navigate-tab',{detail:a.tab}));};
  const fmt=(text)=>text.split('\n').map((l,i)=><div key={i} dangerouslySetInnerHTML={{__html:l.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')||'&nbsp;'}} />);
  const qp=['Add a client','Create a workout','Schedule a session','Today\'s schedule','Show my stats','Help'];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Sparkles size={20} className="text-white" /></div><div><h1 className="text-xl font-bold">AI Coach Assistant</h1><p className="text-xs text-slate-500">I'll guide you step by step</p></div></div>
        <button onClick={()=>{setMessages([messages[0]]);setFlow(null);setCtx({lastClient:null,lastWorkout:null});}} className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">Clear</button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg,i)=>(<div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${msg.role==='user'?'bg-blue-600 text-white':'bg-white border shadow-sm'}`}><div className={`text-sm leading-relaxed ${msg.role==='user'?'text-white':'text-slate-700'}`}>{fmt(msg.text)}</div>{msg.actions&&<div className="flex flex-wrap gap-2 mt-3">{msg.actions.map((a,j)=><button key={j} onClick={()=>handleAction(a)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 border border-blue-200">{a.label} →</button>)}</div>}</div></div>))}
        {loading&&<div className="flex justify-start"><div className="bg-white border rounded-2xl px-5 py-3.5 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><Loader size={16} className="animate-spin" /> Working...</div></div></div>}
        <div ref={bottomRef} />
      </div>
      {messages.length<=1&&<div className="flex flex-wrap gap-2 mb-3">{qp.map((q,i)=><button key={i} onClick={()=>setInput(q)} className="px-3 py-2 bg-white border rounded-xl text-sm text-slate-600 hover:bg-slate-50">{q}</button>)}</div>}
      {flow&&<div className="mb-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700 font-medium flex items-center gap-2"><Sparkles size={12} />{flow.type.replace(/_/g,' ')} in progress <button onClick={()=>{setFlow(null);setMessages(prev=>[...prev,{role:'ai',text:'Cancelled. What would you like to do?'}]);}} className="ml-auto underline">Cancel</button></div>}
      <form onSubmit={handleSubmit} className="flex gap-3 bg-white rounded-2xl border shadow-sm p-2">
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder={flow?'Type your answer...':'Tell me what you need...'} className="flex-1 px-4 py-3 outline-none text-sm" disabled={loading} />
        <button type="submit" disabled={loading||!input.trim()} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-2 hover:bg-blue-700"><Send size={16} /></button>
      </form>
    </div>
  );
};

// === LEADS / INBOX ===
const LeadsView = ({ showToast }) => {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.getLeads(filter === 'all' ? null : filter).then(r => { setLeads(r.leads || []); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(load, [filter]);

  const updateStatus = async (id, status) => {
    await api.updateLead(id, { status }); showToast(`Lead marked as ${status}`); load();
  };
  const convertToClient = async (id) => {
    try { const r = await api.convertLead(id); showToast(r.message || 'Converted!'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const typeColors = { interest: 'bg-blue-100 text-blue-700', callback: 'bg-amber-100 text-amber-700', referral: 'bg-purple-100 text-purple-700' };
  const statusColors = { new: 'bg-emerald-100 text-emerald-700', contacted: 'bg-blue-100 text-blue-700', converted: 'bg-violet-100 text-violet-700', closed: 'bg-slate-100 text-slate-500' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Leads & Interest Requests</h1><p className="text-sm text-slate-500 mt-1">People interested in your coaching from CoachMe.life</p></div>
        <div className="flex items-center gap-2 bg-white rounded-xl border p-1">
          {['all','new','contacted','converted','closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter===f?'bg-blue-600 text-white':'hover:bg-slate-50'}`}>{f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)}</button>
          ))}
        </div>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Loading...</div> :
      leads.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <Inbox size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No leads yet</h3>
          <p className="text-sm text-slate-400 mt-1">When someone expresses interest on your CoachMe.life profile, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">{(lead.name||'?')[0]}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{lead.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeColors[lead.lead_type]||'bg-slate-100'}`}>{lead.lead_type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[lead.status]||'bg-slate-100'}`}>{lead.status}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      {lead.phone && <span>📱 {lead.phone}</span>}
                      {lead.email && <span>📧 {lead.email}</span>}
                      <span>📅 {new Date(lead.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                    {lead.message && <p className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">"{lead.message}"</p>}
                    {lead.referred_by_name && <p className="mt-1 text-xs text-purple-600">🔗 Referred by: {lead.referred_by_name} {lead.referred_by_email ? `(${lead.referred_by_email})` : ''}</p>}
                    {lead.coach_notes && <p className="mt-1 text-xs text-slate-400 italic">Notes: {lead.coach_notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {lead.status === 'new' && (
                    <>
                      <button onClick={() => updateStatus(lead.id, 'contacted')} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 border border-blue-200">Contacted</button>
                      <button onClick={() => convertToClient(lead.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"><UserPlus size={12} /> Convert</button>
                    </>
                  )}
                  {lead.status === 'contacted' && (
                    <button onClick={() => convertToClient(lead.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"><UserPlus size={12} /> Convert to Client</button>
                  )}
                  {lead.status !== 'closed' && lead.status !== 'converted' && (
                    <button onClick={() => updateStatus(lead.id, 'closed')} className="px-2 py-1.5 text-slate-400 hover:text-red-500 text-xs">✕</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// === DASHBOARD ===
const DashboardView = () => {
  const [stats, setStats] = useState(null); const [sessions, setSessions] = useState([]);
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
  { id: 'prompt', icon: Sparkles, label: 'AI Assistant' },
  { id: 'leads', icon: Inbox, label: 'Leads' },
  { id: 'today', icon: Zap, label: 'Today' },
  { id: 'clients', icon: Users, label: 'Clients' },
  { id: 'workouts', icon: Dumbbell, label: 'Workouts' },
  { id: 'schedule', icon: Calendar, label: 'Planner' },
  { id: 'payments', icon: DollarSign, label: 'Payments' },
  { id: 'progress', icon: TrendingUp, label: 'Progress' },
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
];

function App() {
  const [tab, setTab] = useState('prompt');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [coachUser, setCoachUser] = useState(() => { try { return JSON.parse(localStorage.getItem('coach_user')); } catch { return null; } });
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  useEffect(() => {
    const handler = (e) => setTab(e.detail);
    window.addEventListener('navigate-tab', handler);
    return () => window.removeEventListener('navigate-tab', handler);
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const r = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (d.success) { localStorage.setItem('coach_user', JSON.stringify(d.user)); setCoachUser(d.user); return true; }
      else { throw new Error(d.detail || 'Login failed'); }
    } catch (e) { throw e; }
  };
  const handleLogout = () => { localStorage.removeItem('coach_user'); setCoachUser(null); };

  if (!coachUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r flex flex-col z-50 transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b"><div className="flex items-center justify-between"><div className="flex items-center gap-2">{coachUser.logo_url ? <img src={coachUser.logo_url} className="w-9 h-9 rounded-xl object-cover" /> : <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">{(coachUser.full_name||'C')[0]}</div>}<div><span className="font-bold text-sm block">{coachUser.full_name}</span><span className="text-xs text-slate-400">Coach</span></div></div><button onClick={() => setMobileOpen(false)} className="lg:hidden"><X size={20} /></button></div></div>
        <nav className="flex-1 p-3 space-y-1">{navItems.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setMobileOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><item.icon size={20} />{item.label}</button>
        ))}</nav>
        <div className="p-3 border-t"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50">Logout</button></div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden"><Menu size={24} /></button>
          <div className="text-sm text-slate-500 hidden lg:block">{navItems.find(n => n.id === tab)?.label}</div>
          <div className="text-sm text-slate-400">{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </header>
        <main className="flex-1 p-6 overflow-auto"><div className="max-w-6xl mx-auto">
          {tab === 'prompt' && <PromptView showToast={showToast} />}
          {tab === 'leads' && <LeadsView showToast={showToast} />}
          {tab === 'today' && <TodayView onNavigate={setTab} showToast={showToast} />}
          {tab === 'clients' && <ClientsView showToast={showToast} />}
          {tab === 'workouts' && <WorkoutsView showToast={showToast} />}
          {tab === 'schedule' && <ScheduleView showToast={showToast} />}
          {tab === 'payments' && <PaymentsView showToast={showToast} />}
          {tab === 'progress' && <ProgressView showToast={showToast} />}
          {tab === 'dashboard' && <DashboardView />}
        </div></main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}.animate-slideIn{animation:slideIn .3s ease-out}`}</style>
    </div>
  );
}

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await onLogin(email, password); } catch (err) { setError(err.message); }
    setLoading(false);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border p-8 w-full max-w-md">
        <div className="text-center mb-8"><div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3">F</div><h1 className="text-2xl font-black">FitLife Coach</h1><p className="text-slate-500 text-sm mt-1">Sign in to your dashboard</p></div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>}
        <form onSubmit={handle} className="space-y-4">
          <div><label className="block text-sm font-semibold mb-1">Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none focus:border-blue-500" /></div>
          <div><label className="block text-sm font-semibold mb-1">Password</label><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border outline-none focus:border-blue-500" /></div>
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">Don't have an account? <a href="https://www.coachme.life#register" className="text-blue-600 font-semibold">Register at CoachMe.life</a></p>
      </div>
    </div>
  );
};

export default App;
