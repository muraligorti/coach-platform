// Find the attendance tab section in ClientDetailModal component
// Replace the entire attendance tab content with this enhanced version:

{activeTab === 'attendance' && consistency && (
  <div className="space-y-6">
    {/* Consistency Metrics Summary */}
    <div className="bg-white rounded-xl border p-6">
      <h4 className="font-bold text-lg mb-4">Consistency Metrics (Last 30 Days)</h4>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="text-3xl font-bold text-blue-600">{consistency.sessions_scheduled}</div>
          <div className="text-sm text-slate-600 mt-1">Scheduled</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="text-3xl font-bold text-green-600">{consistency.sessions_attended}</div>
          <div className="text-sm text-slate-600 mt-1">Attended</div>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-200">
          <div className="text-3xl font-bold text-orange-600">{consistency.attendance_rate}%</div>
          <div className="text-sm text-slate-600 mt-1">Rate</div>
        </div>
      </div>

      {/* Progress Check Info */}
      <div className="p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Progress Checks</span>
          <span className="text-lg font-bold text-slate-900">{consistency.progress_checks}</span>
        </div>
        <div className="text-xs text-slate-600">
          Frequency: {client.progress_check_frequency || 'Monthly'}
        </div>
      </div>
    </div>

    {/* Detailed Attendance Calendar */}
    <div className="bg-white rounded-xl border p-6">
      <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Calendar size={20} className="text-orange-500" />
        Session-by-Session Attendance
      </h4>

      <div className="space-y-2">
        {sessions.map((session, idx) => {
          const sessionDate = new Date(session.scheduled_at);
          const isCompleted = session.status === 'completed';
          const isPast = sessionDate < new Date();
          const isMissed = isPast && !isCompleted;

          return (
            <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
              isCompleted ? 'bg-green-50 border-green-200' : 
              isMissed ? 'bg-red-50 border-red-200' : 
              'bg-slate-50 border-slate-200'
            }`}>
              {/* Checkbox/Status Indicator */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center">
                    <CheckCircle size={16} className="text-white" />
                  </div>
                ) : isMissed ? (
                  <div className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-md border-2 border-slate-400"></div>
                )}
              </div>

              {/* Session Details */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h5 className="font-semibold text-slate-900">
                    {session.template_name || 'Workout Session'}
                  </h5>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isCompleted ? 'bg-green-100 text-green-700' :
                    isMissed ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {isCompleted ? 'Attended' : isMissed ? 'Missed' : 'Upcoming'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {sessionDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {sessionDate.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    {session.location?.includes('online') || !session.location ? 
                      <Video size={14} /> : <MapPin size={14} />
                    }
                    {session.location || 'Online'}
                  </div>
                </div>
              </div>

              {/* Grade if available */}
              {session.grade_value && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-slate-600">Grade</div>
                  <div className="text-xl font-bold text-orange-600">{session.grade_value}</div>
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>No sessions scheduled yet</p>
          </div>
        )}
      </div>
    </div>

    {/* Attendance Pattern Summary */}
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
      <h4 className="font-bold text-lg mb-4">Attendance Pattern</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-slate-600 mb-1">Best Streak</div>
          <div className="text-2xl font-bold text-green-600">
            {(() => {
              const completed = sessions.filter(s => s.status === 'completed');
              // Simple streak calculation
              let maxStreak = 0;
              let currentStreak = 0;
              completed.forEach(s => {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
              });
              return maxStreak;
            })()} sessions
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-600 mb-1">Missed Sessions</div>
          <div className="text-2xl font-bold text-red-600">
            {sessions.filter(s => {
              const isPast = new Date(s.scheduled_at) < new Date();
              return isPast && s.status !== 'completed';
            }).length}
          </div>
        </div>
      </div>
    </div>
  </div>
)}
