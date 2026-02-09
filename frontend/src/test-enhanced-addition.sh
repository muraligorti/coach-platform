#!/bin/bash

echo "This time, I'll add EnhancedSessionsView WITHOUT breaking SessionsView"
echo "So if it fails, Sessions tab still works"

cd ~/coach-platform/frontend/src

# Find where to insert (right BEFORE SessionsView)
LINE=$(grep -n "^const SessionsView = " App.jsx | head -1 | cut -d: -f1)

if [ -z "$LINE" ]; then
    echo "Could not find SessionsView"
    exit 1
fi

# Calculate insertion point (one line before SessionsView)
INSERT_LINE=$((LINE - 1))

echo "Will insert EnhancedSessionsView at line $INSERT_LINE"
echo "SessionsView remains at line $LINE (unchanged)"

# Create the component
cat > enhanced-sessions.js << 'COMPONENT'

// Enhanced Sessions View with Active/Upcoming filters
const EnhancedSessionsView = () => {
  const [filter, setFilter] = useState('all'); // all, today, upcoming
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, clientsRes] = await Promise.all([
        filter === 'today' ? api.getActiveSessions() : 
        filter === 'upcoming' ? api.getUpcomingSessions(7) :
        api.getSessions(),
        api.getClients()
      ]);
      if (sessionsRes.success) setSessions(sessionsRes.sessions || []);
      if (clientsRes.success) setClients(clientsRes.clients || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAttended = async (sessionId) => {
    try {
      await api.updateSessionStatus(sessionId, 'completed');
      alert('✅ Marked as attended!');
      loadData();
    } catch (err) {
      alert('Failed to update');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sessions</h2>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border bg-white">
            <option value="all">All Sessions</option>
            <option value="today">🟢 Active Today</option>
            <option value="upcoming">📅 Upcoming (7 days)</option>
          </select>
          <button onClick={() => setIsScheduleModalOpen(true)} 
            className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
            <Plus size={20} />Schedule Session
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">Client</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Date & Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s, i) => {
                const isPast = new Date(s.scheduled_at) < new Date();
                const canMarkAttended = isPast && s.status !== 'completed';
                
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
                          {s.client_name?.charAt(0)}
                        </div>
                        <span className="font-medium">{s.client_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{new Date(s.scheduled_at).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {canMarkAttended && (
                        <button onClick={() => markAttended(s.id)}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">
                          ✓ Mark Attended
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ScheduleSessionModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)} 
        onSuccess={loadData} 
        clients={clients} 
      />
    </div>
  );
};

COMPONENT

# Insert it
sed -i "${INSERT_LINE}r enhanced-sessions.js" App.jsx

# Verify it was added
if grep -q "const EnhancedSessionsView" App.jsx; then
    echo "✅ EnhancedSessionsView added successfully"
    
    # Now update the switch statement to use it
    sed -i "s/case 'sessions': return <SessionsView/case 'sessions': return <EnhancedSessionsView/g" App.jsx
    
    echo "✅ Switch statement updated to use EnhancedSessionsView"
    
    # Clean up temp file
    rm enhanced-sessions.js
    
    echo ""
    echo "Testing build..."
    cd ~/coach-platform/frontend
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Build successful!"
        echo "Deploying..."
        az storage blob upload-batch \
          --account-name coachfront49992 \
          --source ./dist \
          --destination '$web' \
          --overwrite
        
        echo ""
        echo "✅ Enhanced Sessions deployed!"
        echo "Features:"
        echo "  - Filter: All / Active Today / Upcoming"
        echo "  - Mark Attended button on past sessions"
        echo "  - Same schedule session functionality"
    else
        echo "❌ Build failed - restoring backup"
        cd src
        cp App.jsx.backup-before-enhanced App.jsx
        cd ..
        npm run build
        az storage blob upload-batch --account-name coachfront49992 --source ./dist --destination '$web' --overwrite
        echo "Restored to working version"
    fi
else
    echo "❌ Failed to add component"
fi

