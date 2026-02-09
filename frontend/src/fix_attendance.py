import re

# Read the file
with open('App.jsx', 'r') as f:
    content = f.read()

# Find the attendance section and add the enhanced code
# Look for the closing of the metrics section, then add the new sections

# The pattern to find: right after the progress checks section ends
pattern = r"(Frequency: {client\.progress_check_frequency \|\| 'Monthly'}\s*</div>\s*</div>\s*</div>)\s*</div>\s*\)\}"

# The new code to insert
new_sections = '''

                {/* Session-by-Session Attendance List */}
                <div className="bg-white rounded-xl border p-6 mt-6">
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-orange-500" />
                    Session-by-Session Attendance Record
                  </h4>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sessions
                      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
                      .map((session, idx) => {
                        const sessionDate = new Date(session.scheduled_at);
                        const isCompleted = session.status === 'completed';
                        const isPast = sessionDate < new Date();
                        const isMissed = isPast && !isCompleted;

                        return (
                          <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
                            isCompleted ? 'bg-green-50 border-green-300' : 
                            isMissed ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'
                          }`}>
                            <div className="flex-shrink-0">
                              {isCompleted ? (
                                <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center">
                                  <CheckCircle size={18} className="text-white" strokeWidth={3} />
                                </div>
                              ) : isMissed ? (
                                <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
                                  <X size={18} className="text-white" strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-lg border-3 border-blue-400 bg-white"></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h5 className="font-semibold">{session.template_name || 'Session'}</h5>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isCompleted ? 'bg-green-200 text-green-800' :
                                  isMissed ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                                }`}>
                                  {isCompleted ? '✓ ATTENDED' : isMissed ? '✗ MISSED' : 'UPCOMING'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <div className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  {sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {sessionDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Insights */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 p-6 mt-6">
                  <h4 className="font-bold text-lg mb-4">Attendance Insights</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/70 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Completed</div>
                      <div className="text-3xl font-bold text-green-600">
                        {sessions.filter(s => s.status === 'completed').length}
                      </div>
                    </div>
                    <div className="bg-white/70 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Missed</div>
                      <div className="text-3xl font-bold text-red-600">
                        {sessions.filter(s => new Date(s.scheduled_at) < new Date() && s.status !== 'completed').length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}'''

# Replace
replacement = r'\1' + new_sections + '\n            )}'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open('App.jsx', 'w') as f:
    f.write(content)

print("✅ File updated!")
