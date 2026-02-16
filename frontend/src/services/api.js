// frontend/src/services/api.js
// CoachFlow V2 — API Service Layer

const API = import.meta.env.VITE_API_URL || 'https://coach-api-1770519048.azurewebsites.net/api/v1';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error(`API ${method} ${path}:`, err);
    throw err;
  }
}

const api = {
  // ─── Dashboard ────────────────────────────────────────────────────
  getDashboardStats: () => request('GET', '/dashboard/stats'),

  // ─── Schedule ─────────────────────────────────────────────────────
  getTodaySchedule: () => request('GET', '/schedule/today'),
  getWeekSchedule: () => request('GET', '/schedule/week'),
  startSession: (id) => request('POST', `/sessions/${id}/start`),
  completeSession: (id, data) => request('POST', `/sessions/${id}/complete`, data),
  markAttendance: (id, status) => request('PUT', `/sessions/${id}/attendance`, { status }),
  rescheduleSession: (id, data) => request('PUT', `/sessions/${id}/reschedule`, data),
  cancelSession: (id, reason) => request('PUT', `/sessions/${id}/cancel`, { reason }),
  bulkPlanSessions: (sessions) => request('POST', '/schedule/bulk-plan', { sessions }),

  // ─── Clients ──────────────────────────────────────────────────────
  getClients: () => request('GET', '/clients'),
  createClient: (data) => request('POST', '/clients', data),
  updateClient: (id, data) => request('PUT', `/clients/${id}`, data),
  deleteClient: (id) => request('DELETE', `/clients/${id}`),
  assignWorkout: (clientId, workoutId) => request('POST', `/clients/${clientId}/assign-workout`, { workout_id: workoutId }),

  // ─── Workouts / Templates ────────────────────────────────────────
  getWorkouts: () => request('GET', '/workouts'),
  createWorkout: (data) => request('POST', '/workouts', data),
  updateWorkout: (id, data) => request('PUT', `/workouts/${id}`, data),
  deleteWorkout: (id) => request('DELETE', `/workouts/${id}`),

  // ─── Availability ─────────────────────────────────────────────────
  getAvailability: () => request('GET', '/availability'),
  updateWorkingDays: (days, recurring) => request('PUT', '/availability/days', { working_days: days, recurring_type: recurring }),
  addSlot: (data) => request('POST', '/availability/slots', data),
  deleteSlot: (id) => request('DELETE', `/availability/slots/${id}`),
  addHoliday: (data) => request('POST', '/availability/holidays', data),
  deleteHoliday: (id) => request('DELETE', `/availability/holidays/${id}`),

  // ─── Leads ────────────────────────────────────────────────────────
  getLeads: () => request('GET', '/leads'),
  createLead: (data) => request('POST', '/leads', data),
  updateLead: (id, data) => request('PUT', `/leads/${id}`, data),
  deleteLead: (id) => request('DELETE', `/leads/${id}`),
  convertLead: (id, data) => request('POST', `/leads/${id}/convert`, data || {}),

  // ─── Payments ─────────────────────────────────────────────────────
  getPayments: () => request('GET', '/coach-payments'),
  getPaymentSummary: () => request('GET', '/coach-payments/summary'),
  createPayment: (data) => request('POST', '/coach-payments', data),
  updatePayment: (id, data) => request('PUT', `/coach-payments/${id}`, data),
  deletePayment: (id) => request('DELETE', `/coach-payments/${id}`),

  // ─── Auth ─────────────────────────────────────────────────────────
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  registerCoach: (data) => request('POST', '/coaches/register', data),

  // ─── Bulk ─────────────────────────────────────────────────────────
  bulkImportClients: (clients) => request('POST', '/clients/bulk-import', { clients }),
  bulkImportWorkouts: (workouts) => request('POST', '/workouts/bulk-import', { workouts }),

  // ─── Progress ─────────────────────────────────────────────────────
  uploadProgress: (data) => request('POST', '/progress/upload', data),

  // ─── Reminders ────────────────────────────────────────────────────
  sendReminders: (sessionIds, method) => request('POST', '/reminders/send', { session_ids: sessionIds, method }),
};

export default api;
