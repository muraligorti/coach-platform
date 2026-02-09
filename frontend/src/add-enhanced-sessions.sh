#!/bin/bash

echo "Adding Enhanced Sessions View to App.jsx..."

# Find where SessionsView is defined
LINE=$(grep -n "const SessionsView = " App.jsx | head -1 | cut -d: -f1)

if [ -z "$LINE" ]; then
    echo "❌ Could not find SessionsView"
    exit 1
fi

echo "Found SessionsView at line $LINE"

# Create the new Enhanced component
cat > enhanced-component.txt << 'COMPONENT'

// ============================================================================
// ENHANCED SESSIONS VIEW - Coach Workflow
// ============================================================================
const EnhancedSessionsView = () => {
  const [view, setView] = useState('active');
  const [activeSessions, setActiveSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionWorkouts, setSessionWorkouts] = useState([]);
  const [completedWorkouts, setCompletedWorkouts] = useState([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSessions(); }, [view]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      if (view === 'active') {
        const result = await api.getActiveSessions();
        if (result.success) setActiveSessions(result.sessions || []);
      } else {
        const result = await api.getUpcomingSessions(7);
        if (result.success) setUpcomingSessions(result.sessions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkouts = async (sessionId) => {
    try {
      const result = await api.getSessionWorkouts(sessionId);
      if (result.success) setSessionWorkouts(result.workouts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const updateWorkouts = async () => {
    if (!selectedSession) return;
    try {
      const result = await api.updateSessionWorkouts(selectedSession.id, completedWorkouts, sessionNotes);
      if (result.success) {
        alert('✅ Workouts updated!');
        setSelectedSession(null);
        loadSessions();
      }
    } catch (err) {
      alert('Failed to update');
    }
  };

  const markAttendance = async (sessionId, status) => {
    try {
      const result = await api.updateSessionStatus(sessionId, status);
      if (result.success) {
        alert(status === 'completed' ? '✅ Marked attended!' : '❌ Marked absent');
        loadSessions();
      }
    } catch (err) {
      alert('Failed');
    }
  };

  const sessions = view === 'active' ? activeSessions : upcomingSessions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('active')}
            className={`px-6 py-3 rounded-xl font-medium ${view === 'active' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' : 'bg-white border'}`}>
            🟢 Active Today ({activeSessions.length})
          </button>
          <button onClick={() => setView('upcoming')}
            className={`px-6 py-3 rounded-xl font-medium ${view === 'upcoming' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' : 'bg-white border'}`}>
            📅 Upcoming ({upcomingSessions.length})
          </button>
        </div>
        <button onClick={loadSessions} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200">🔄 Refresh</button>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <Calendar size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600">No {view} sessions</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {sessions.map(session => {
            const time = new Date(session.scheduled_at);
            const isActive = view === 'active';
            return (
              <div key={session.id} className={`bg-white rounded-2xl border-2 p-6 hover:shadow-xl ${isActive ? 'border-green-300' : 'border-blue-200'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{session.client_name}</h3>
                    <p className="text-sm text-slate-600">
                      {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {isActive ? '🟢 ACTIVE' : '📅 UPCOMING'}
                  </div>
                </div>

                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                  <div className="text-sm text-slate-600">Workout</div>
                  <div className="font-semibold">{session.workout_name || 'No workout assigned'}</div>
                </div>

                {isActive && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setSelectedSession(session); loadWorkouts(session.id); }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600">
                        📝 Update Workouts
                      </button>
                      <button onClick={() => markAttendance(session.id, 'completed')}
                        className="px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600">
                        ✓ Attended
                      </button>
                    </div>
                    <button onClick={() => markAttendance(session.id, 'cancelled')}
                      className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200">
                      ✗ Absent
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedSession && (
        <Modal isOpen={true} onClose={() => setSelectedSession(null)} title={`Update Workouts - ${selectedSession.client_name}`} size="lg">
          <div className="space-y-4">
            <h4 className="font-bold">Select Completed Workouts:</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sessionWorkouts.map(w => (
                <label key={w.workout_id} className="flex items-center gap-3 p-3 rounded-xl border-2 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" 
                    checked={completedWorkouts.includes(w.workout_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCompletedWorkouts([...completedWorkouts, w.workout_id]);
                      } else {
                        setCompletedWorkouts(completedWorkouts.filter(id => id !== w.workout_id));
                      }
                    }}
                    className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">{w.workout_name}</div>
                    {w.description && <div className="text-sm text-slate-600">{w.description}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Session Notes</label>
              <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border" rows={3} placeholder="Notes about this session..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelectedSession(null)} className="flex-1 px-4 py-3 rounded-xl border">Cancel</button>
              <button onClick={updateWorkouts} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium">
                ✅ Save Updates
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

COMPONENT

# Insert the component before the old SessionsView
sed -i "${LINE}r enhanced-component.txt" App.jsx

# Now replace the usage of SessionsView with EnhancedSessionsView in the App component
sed -i "s/case 'sessions': return <SessionsView/case 'sessions': return <EnhancedSessionsView/g" App.jsx

echo "✅ Enhanced Sessions component added!"
echo "✅ Updated App to use EnhancedSessionsView!"

# Clean up
rm enhanced-component.txt

# Verify
if grep -q "EnhancedSessionsView" App.jsx; then
    echo "✅✅ SUCCESS - EnhancedSessionsView is now in App.jsx"
else
    echo "❌ Something went wrong"
fi

