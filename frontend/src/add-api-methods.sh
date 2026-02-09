#!/bin/bash

cd ~/coach-platform/frontend/src

# Find where the api object ends
LINE=$(grep -n "async assignWorkout" App.jsx | tail -1 | cut -d: -f1)

if [ -z "$LINE" ]; then
    echo "Could not find API methods location"
    exit 1
fi

echo "Adding new API methods after line $LINE"

# Create the new methods to insert
cat > new-api-methods.txt << 'METHODS'
  async getCoachTimeSlots() { return this.request('/coach/time-slots'); },
  async createTimeSlot(data) { return this.request('/coach/time-slots', { method: 'POST', body: JSON.stringify(data) }); },
  async assignToSlot(data) { return this.request('/sessions/assign-to-slot', { method: 'POST', body: JSON.stringify(data) }); },
  async cancelSession(sessionId, reason, cancelledBy = 'coach') {
    return this.request(`/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, cancelled_by: cancelledBy })
    });
  },
  async markAttendance(sessionId, status, notes = null, lateMinutes = null) {
    return this.request(`/sessions/${sessionId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ status, notes, late_minutes: lateMinutes })
    });
  },
  async getFilteredSessions(filters) {
    const query = new URLSearchParams(filters).toString();
    return this.request(`/sessions/filter?${query}`);
  },
METHODS

# Insert after assignWorkout
sed -i "${LINE}r new-api-methods.txt" App.jsx

rm new-api-methods.txt

if grep -q "getCoachTimeSlots" App.jsx; then
    echo "✅ API methods added"
else
    echo "❌ Failed to add API methods"
fi

