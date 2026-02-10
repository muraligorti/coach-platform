import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, TrendingUp, Award, Share2, BarChart3, Bell, Menu, X, 
  Plus, Clock, CheckCircle, Star, Send, LogOut, Video, MapPin, DollarSign, 
  CreditCard, Gift, BookOpen, UserPlus, Dumbbell, Filter, Search, Eye,
  Phone, Mail, Edit, Trash2, Activity, FileText, ArrowLeft
} from 'lucide-react';

const API_URL = 'https://coach-api-1770519048.azurewebsites.net/api/v1';

// ============================================================================
// API SERVICE
// ============================================================================
const api = {
  async request(endpoint, options = {}) {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },
  
  // Clients
  async getClients() { return this.request('/clients'); },
  async getClient(id) { return this.request(`/clients/${id}`); },
  async createClient(data) { return this.request('/clients', { method: 'POST', body: JSON.stringify(data) }); },
  async createClientEnhanced(data) { return this.request('/clients/enhanced', { method: 'POST', body: JSON.stringify(data) }); },
  
  // Sessions
  async getSessions(params = {}) { 
    const query = new URLSearchParams(params).toString();
    return this.request(`/sessions${query ? '?' + query : ''}`); 
  },
  async createSession(data) { return this.request('/sessions', { method: 'POST', body: JSON.stringify(data) }); },
  
  // Stats & Payments
  async getDashboardStats() { return this.request('/dashboard/stats'); },
  async createPaymentLink(data) { return this.request('/payments/create-link', { method: 'POST', body: JSON.stringify(data) }); },
  async getClientPayments(clientId) { return this.request(`/payments/client/${clientId}`); },
  
  // Progress & Grades
  async getClientProgress(clientId) { return this.request(`/progress/client/${clientId}`); },
  async getClientGrades(clientId) { return this.request(`/grading/client/${clientId}`); },
  async getClientConsistency(clientId, days = 30) { return this.request(`/progress/consistency/${clientId}?days=${days}`); },
  async sendProgressReminder(clientId) { return this.request(`/progress/reminder/${clientId}`, { method: 'POST' }); },
  
  // Referrals & Coaches
  async getReferrals() { return this.request('/referrals'); },
  async getCoaches() { return this.request('/coaches'); },
  async registerCoach(data) { return this.request('/coaches/register', { method: 'POST', body: JSON.stringify(data) }); },
  
  // Workouts & Nutrition
  async getWorkouts(category) { 
    const url = category ? `/workouts/library?category=${category}` : '/workouts/library';
    return this.request(url); 
  },
  async createWorkout(data) { 
    const coaches = await this.request('/coaches');
    const coachId = coaches.coaches?.[0]?.id || 'default';
    return this.request(`/workouts/library?coach_id=${coachId}`, { method: 'POST', body: JSON.stringify(data) }); 
  },
  async assignWorkout(data) { return this.request('/workouts/assign-to-client', { method: 'POST', body: JSON.stringify(data) }); },
  async cancelSession(sessionId, reason, cancelledBy = 'coach') {
    return this.request(`/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, cancelled_by: cancelledBy })
    });
  },
  async markAttendance(sessionId, status, notes = null) {
    return this.request(`/sessions/${sessionId}/mark-attendance`, {
      method: 'POST',
      body: JSON.stringify({ status, notes })
    });
  },
  async createRecurringSessions(data) {
    return this.request('/sessions/create-recurring', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async getNutritionPlans() { return this.request('/nutrition/plans'); },
  async createNutritionPlan(data) { return this.request('/nutrition/plans', { method: 'POST', body: JSON.stringify(data) }); },
  async assignNutrition(planId, clientId, startDate, coachId) {
    return this.request('/nutrition/assign', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, client_id: clientId, start_date: startDate, coach_id: coachId })
    });
  },
};

// ============================================================================
// MODAL COMPONENT
// ============================================================================
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizeClasses = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="hover:bg-slate-100 p-2 rounded-lg transition-colors"><X size={24} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ============================================================================
// ENHANCED ADD CLIENT MODAL (4 STEPS)
// ============================================================================
const AddClientEnhancedModal = ({ isOpen, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    current_weight: '', target_weight: '', height: '', age: '', gender: '',
    target_body_type: '', fitness_goal: '',
    current_diet: '', dietary_restrictions: [], target_calories: '',
    medical_conditions: [], injuries: [], activity_level: 'moderate', sleep_hours: 7,
    progress_check_frequency: 'monthly'
  });
  const [loading, setLoading] = useState(false);
  const [restrictionInput, setRestrictionInput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.createClientEnhanced(formData);
      if (result.success) {
        alert('✅ Client created with full profile!');
        onSuccess();
        onClose();
        setCurrentStep(1);
        setFormData({
          name: '', email: '', phone: '',
          current_weight: '', target_weight: '', height: '', age: '', gender: '',
          target_body_type: '', fitness_goal: '',
          current_diet: '', dietary_restrictions: [], target_calories: '',
          medical_conditions: [], injuries: [], activity_level: 'moderate', sleep_hours: 7,
          progress_check_frequency: 'monthly'
        });
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addRestriction = () => {
    if (restrictionInput.trim()) {
      setFormData({...formData, dietary_restrictions: [...formData.dietary_restrictions, restrictionInput.trim()]});
      setRestrictionInput('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Client - Detailed Profile" size="lg">
      <form onSubmit={handleSubmit}>
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map(step => (
            <div key={step} className="flex-1 mx-1">
              <div className={`h-2 rounded-full transition-all ${currentStep >= step ? 'bg-orange-500' : 'bg-slate-200'}`} />
              <div className="text-xs mt-1 text-center font-medium">
                {step === 1 && 'Basic Info'}
                {step === 2 && 'Physical'}
                {step === 3 && 'Goals & Diet'}
                {step === 4 && 'Medical'}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name *</label>
              <input type="text" required value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input type="email" value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input type="tel" value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none"
                  placeholder="+91 98765 43210" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Physical Details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Weight (kg)</label>
                <input type="number" step="0.1" value={formData.current_weight}
                  onChange={(e) => setFormData({...formData, current_weight: parseFloat(e.target.value) || ''})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Target Weight (kg)</label>
                <input type="number" step="0.1" value={formData.target_weight}
                  onChange={(e) => setFormData({...formData, target_weight: parseFloat(e.target.value) || ''})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Height (cm)</label>
                <input type="number" value={formData.height}
                  onChange={(e) => setFormData({...formData, height: parseFloat(e.target.value) || ''})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Age</label>
                <input type="number" value={formData.age}
                  onChange={(e) => setFormData({...formData, age: parseInt(e.target.value) || ''})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Gender</label>
                <select value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none">
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Goals & Diet */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target Body Type</label>
                <select value={formData.target_body_type}
                  onChange={(e) => setFormData({...formData, target_body_type: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none">
                  <option value="">Select...</option>
                  <option value="lean">Lean</option>
                  <option value="muscular">Muscular</option>
                  <option value="athletic">Athletic</option>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="toned">Toned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fitness Goal</label>
                <select value={formData.fitness_goal}
                  onChange={(e) => setFormData({...formData, fitness_goal: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none">
                  <option value="">Select...</option>
                  <option value="strength">Build Strength</option>
                  <option value="endurance">Improve Endurance</option>
                  <option value="flexibility">Increase Flexibility</option>
                  <option value="weight_loss">Lose Weight</option>
                  <option value="muscle_gain">Gain Muscle</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Current Diet</label>
              <textarea value={formData.current_diet}
                onChange={(e) => setFormData({...formData, current_diet: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" rows={2}
                placeholder="Describe current eating habits..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dietary Restrictions</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={restrictionInput}
                  onChange={(e) => setRestrictionInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRestriction())}
                  className="flex-1 px-4 py-3 rounded-xl border focus:border-orange-500 outline-none"
                  placeholder="e.g., Gluten-free, Vegan" />
                <button type="button" onClick={addRestriction}
                  className="px-6 py-3 rounded-xl bg-orange-100 text-orange-700 hover:bg-orange-200">Add</button>
              </div>
              {formData.dietary_restrictions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.dietary_restrictions.map((r, i) => (
                    <span key={i} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-2">
                      {r}
                      <button type="button" onClick={() => setFormData({...formData, dietary_restrictions: formData.dietary_restrictions.filter((_, idx) => idx !== i)})}
                        className="font-bold hover:text-orange-900">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Target Calories/Day</label>
              <input type="number" value={formData.target_calories}
                onChange={(e) => setFormData({...formData, target_calories: parseInt(e.target.value) || ''})}
                className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none"
                placeholder="e.g., 2000" />
            </div>
          </div>
        )}

        {/* Step 4: Medical & Lifestyle */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Activity Level</label>
              <select value={formData.activity_level}
                onChange={(e) => setFormData({...formData, activity_level: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none">
                <option value="sedentary">Sedentary (little/no exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
                <option value="very_active">Very Active (2x per day)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Average Sleep Hours</label>
              <input type="number" min="0" max="24" value={formData.sleep_hours}
                onChange={(e) => setFormData({...formData, sleep_hours: parseInt(e.target.value) || 7})}
                className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Progress Check Frequency</label>
              <select value={formData.progress_check_frequency}
                onChange={(e) => setFormData({...formData, progress_check_frequency: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border focus:border-orange-500 outline-none">
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly (2 weeks)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-6">
          {currentStep > 1 && (
            <button type="button" onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">
              ← Back
            </button>
          )}
          {currentStep < 4 ? (
            <button type="button" onClick={() => setCurrentStep(currentStep + 1)}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:shadow-lg">
              Next →
            </button>
          ) : (
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:shadow-lg disabled:opacity-50">
              {loading ? 'Creating...' : '✅ Create Client'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// CLIENT DETAIL MODAL
// ============================================================================
const ClientDetailModal = ({ isOpen, onClose, client }) => {
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [consistency, setConsistency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isOpen && client) {
      loadClientDetails();
    }
  }, [isOpen, client]);

  const loadClientDetails = async () => {
    setLoading(true);
    try {
      const [sessionsRes, paymentsRes, consistencyRes] = await Promise.all([
        api.getSessions({ client_id: client.id }),
        api.getClientPayments(client.id),
        api.getClientConsistency(client.id)
      ]);

      if (sessionsRes.success) setSessions(sessionsRes.sessions || []);
      if (paymentsRes.success) setPayments(paymentsRes.payments || []);
      if (consistencyRes.success) setConsistency(consistencyRes.consistency);
    } catch (err) {
      console.error('Failed to load client details:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async () => {
    try {
      const result = await api.sendProgressReminder(client.id);
      if (result.success) {
        alert('✅ Progress reminder sent!');
      }
    } catch (err) {
      alert('Failed to send reminder');
    }
  };

  if (!client) return null;

  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const totalPaid = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={client.name} size="xl">
      <div className="space-y-6">
        {/* Header with Contact */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold">
                {client.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">{client.name}</h3>
                <div className="flex items-center gap-4 text-sm opacity-90">
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:underline">
                      <Mail size={14} /> {client.email}
                    </a>
                  )}
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:underline">
                      <Phone size={14} /> {client.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-75">Overall Grade</div>
              <div className="text-4xl font-bold">{client.overall_grade}</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Calendar size={20} className="text-blue-600" />
              <span className="text-2xl font-bold text-blue-900">{sessions.length}</span>
            </div>
            <div className="text-sm text-blue-700 font-medium">Total Sessions</div>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle size={20} className="text-green-600" />
              <span className="text-2xl font-bold text-green-900">
                {consistency?.attendance_rate || 0}%
              </span>
            </div>
            <div className="text-sm text-green-700 font-medium">Attendance</div>
          </div>

          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={20} className="text-purple-600" />
              <span className="text-2xl font-bold text-purple-900">₹{totalPaid.toFixed(0)}</span>
            </div>
            <div className="text-sm text-purple-700 font-medium">Total Paid</div>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={20} className="text-orange-600" />
              <span className="text-2xl font-bold text-orange-900">{client.progress}%</span>
            </div>
            <div className="text-sm text-orange-700 font-medium">Progress</div>
          </div>
        </div>

        {/* Progress Reminder Alert */}
        {consistency?.progress_check_due && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={24} className="text-yellow-600" />
              <div>
                <div className="font-semibold text-yellow-900">Progress Check Due!</div>
                <div className="text-sm text-yellow-700">
                  {consistency.days_since_last_check !== null 
                    ? `Last check: ${consistency.days_since_last_check} days ago`
                    : 'No progress checks recorded yet'
                  }
                </div>
              </div>
            </div>
            <button onClick={sendReminder}
              className="px-4 py-2 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition-colors">
              Send Reminder
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4">
            {['overview', 'workouts', 'attendance', 'payments'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition-all ${
                  activeTab === tab ? 'border-b-2 border-orange-500 text-orange-600' : 'text-slate-600 hover:text-slate-900'
                }`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading details...</p>
          </div>
        ) : (
          <div>
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border p-6">
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Phone size={20} className="text-orange-500" />
                    Contact Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-600 mb-1">Email</div>
                      <div className="font-medium">{client.email || 'Not provided'}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 mb-1">Phone</div>
                      <div className="font-medium">{client.phone || 'Not provided'}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 mb-1">Member Since</div>
                      <div className="font-medium">{new Date(client.created_at || Date.now()).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-600 mb-1">Status</div>
                      <div className="font-medium capitalize">{client.status || 'active'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'workouts' && (
              <div className="space-y-3">
                <h4 className="font-bold text-lg mb-4">Assigned Workouts ({sessions.length})</h4>
                {sessions.map((s, i) => (
                  <div key={i} className="bg-white border rounded-xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="font-semibold text-lg mb-1">{s.template_name || 'Session'}</h5>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(s.scheduled_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(s.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          <div className="flex items-center gap-1">
                            {s.location?.includes('online') || !s.location ? <Video size={14} /> : <MapPin size={14} />}
                            {s.location || 'Online'}
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        s.status === 'completed' ? 'bg-green-100 text-green-700' : 
                        s.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Dumbbell size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No workouts assigned yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'attendance' && consistency && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border p-6">
                  <h4 className="font-bold text-lg mb-4">Consistency Metrics (Last 30 Days)</h4>
                  <div className="grid grid-cols-3 gap-4">
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

                  <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Progress Checks</span>
                      <span className="text-lg font-bold text-slate-900">{consistency.progress_checks}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Frequency: {client.progress_check_frequency || 'Monthly'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-lg">Payment History</h4>
                  <div className="text-sm">
                    <span className="text-green-600 font-medium">Total Paid: ₹{totalPaid.toFixed(0)}</span>
                  </div>
                </div>
                {payments.map((p, i) => (
                  <div key={i} className="bg-white border rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        p.status === 'success' ? 'bg-green-100' : 
                        p.status === 'pending' ? 'bg-orange-100' : 'bg-red-100'
                      }`}>
                        <DollarSign size={24} className={
                          p.status === 'success' ? 'text-green-600' :
                          p.status === 'pending' ? 'text-orange-600' : 'text-red-600'
                        } />
                      </div>
                      <div>
                        <div className="font-semibold text-lg">₹{parseFloat(p.amount || 0).toFixed(2)}</div>
                        <div className="text-sm text-slate-600">
                          {new Date(p.created_at).toLocaleDateString()} • {p.payment_method || 'razorpay'}
                        </div>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                      p.status === 'success' ? 'bg-green-100 text-green-700' :
                      p.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                ))}
                {payments.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No payment history</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// KEEP ALL OTHER EXISTING MODALS (from previous version)
// ============================================================================

const CoachRegistrationModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', password: '',
    specialization: 'gym', bio: '', experience_years: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await api.registerCoach(formData);
      
      if (result.success) {
        alert('✅ Coach registered successfully!');
        onSuccess(result);
        onClose();
        setFormData({
          full_name: '', email: '', phone: '', password: '',
          specialization: 'gym', bio: '', experience_years: 0
        });
      } else {
        setError(result.detail || result.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to register coach');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register New Coach" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name *</label>
          <input type="text" required value={formData.full_name} 
            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input type="email" required value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>
            <input type="tel" required value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none"
              placeholder="+91 98765 43210" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input type="password" value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Specialization *</label>
            <select value={formData.specialization}
              onChange={(e) => setFormData({...formData, specialization: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none">
              <option value="yoga">🧘 Yoga</option>
              <option value="gym">🏋️ Gym</option>
              <option value="cardio">🏃 Cardio</option>
              <option value="nutrition">🥗 Nutrition</option>
              <option value="pilates">🤸 Pilates</option>
              <option value="crossfit">💪 CrossFit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Experience (years)</label>
            <input type="number" min="0" value={formData.experience_years}
              onChange={(e) => setFormData({...formData, experience_years: parseInt(e.target.value) || 0})}
              className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bio</label>
          <textarea value={formData.bio}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border focus:border-purple-500 outline-none"
            rows={3} placeholder="Tell us about your coaching experience..." />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50">
          {loading ? 'Registering...' : '✨ Register as Coach'}
        </button>
      </form>
    </Modal>
  );
};

const AddWorkoutModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '', description: '', category: 'gym', difficulty_level: 'intermediate',
    duration_minutes: 60, equipment_needed: [], tags: []
  });
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.createWorkout(formData);
      if (result.success) {
        alert('✅ Workout added to library!');
        onSuccess();
        onClose();
        setFormData({ name: '', description: '', category: 'gym', difficulty_level: 'intermediate', duration_minutes: 60, equipment_needed: [], tags: [] });
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addEquipment = () => {
    if (equipment.trim()) {
      setFormData({...formData, equipment_needed: [...formData.equipment_needed, equipment.trim()]});
      setEquipment('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Workout to Library">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Workout Name *</label>
          <input type="text" required value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border outline-none"
            placeholder="e.g., HIIT Full Body Blast" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border outline-none" rows={3} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="yoga">🧘 Yoga</option>
              <option value="gym">🏋️ Gym</option>
              <option value="cardio">🏃 Cardio</option>
              <option value="hiit">⚡ HIIT</option>
              <option value="nutrition">🥗 Nutrition</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Difficulty</label>
            <select value={formData.difficulty_level}
              onChange={(e) => setFormData({...formData, difficulty_level: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Duration (min)</label>
            <input type="number" value={formData.duration_minutes}
              onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 60})}
              className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Equipment</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEquipment())}
              className="flex-1 px-4 py-3 rounded-xl border outline-none" />
            <button type="button" onClick={addEquipment}
              className="px-6 py-3 rounded-xl bg-purple-100 text-purple-700">Add</button>
          </div>
          {formData.equipment_needed.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.equipment_needed.map((eq, i) => (
                <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-2">
                  {eq}
                  <button type="button" onClick={() => setFormData({...formData, equipment_needed: formData.equipment_needed.filter((_, idx) => idx !== i)})}
                    className="font-bold">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium">
          {loading ? 'Adding...' : '📚 Add to Library'}
        </button>
      </form>
    </Modal>
  );
};

const AssignWorkoutModal = ({ isOpen, onClose, onSuccess, clients, workouts }) => {
  const [selectedWorkout, setSelectedWorkout] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [dates, setDates] = useState(['']);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const coaches = await api.getCoaches();
      const coachId = coaches.coaches?.[0]?.id || 'default';
      
      const result = await api.assignWorkout({
        workout_id: selectedWorkout,
        client_id: selectedClient,
        scheduled_dates: dates.filter(d => d),
        coach_id: coachId,
        notes: 'Assigned from workout library'
      });
      if (result.success) {
        alert(`✅ Workout assigned! ${result.sessions_created} sessions created.`);
        onSuccess();
        onClose();
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Workout to Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Select Workout *</label>
          <select required value={selectedWorkout}
            onChange={(e) => setSelectedWorkout(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border outline-none">
            <option value="">Choose a workout...</option>
            {workouts.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.category})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select Client *</label>
          <select required value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border outline-none">
            <option value="">Choose a client...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Schedule Dates *</label>
          {dates.map((date, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="datetime-local" value={date}
                onChange={(e) => {
                  const newDates = [...dates];
                  newDates[i] = e.target.value;
                  setDates(newDates);
                }}
                className="flex-1 px-4 py-3 rounded-xl border outline-none" />
              {i === dates.length - 1 && (
                <button type="button" onClick={() => setDates([...dates, ''])}
                  className="px-4 py-3 rounded-xl bg-purple-100 text-purple-700">+</button>
              )}
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium">
          {loading ? 'Assigning...' : '✅ Assign Workout'}
        </button>
      </form>
    </Modal>
  );
};

const AddClientModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.createClient(formData);
      if (result.success) {
        onSuccess();
        onClose();
        setFormData({ name: '', email: '', phone: '' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Add Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name *</label>
          <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Phone</label>
          <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white">
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ScheduleSessionModal = ({ isOpen, onClose, onSuccess, clients }) => {
  const [formData, setFormData] = useState({
    client_id: '', scheduled_at: '', duration_minutes: 60, location_type: 'online', notes: '',recurrence_type: 'once',num_sessions: 1
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createSession(formData);
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Session">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Client *</label>
          <select required value={formData.client_id} onChange={(e) => setFormData({...formData, client_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none">
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Date & Time *</label>
          <input type="datetime-local" required value={formData.scheduled_at} onChange={(e) => setFormData({...formData, scheduled_at: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Duration (min)</label>
            <input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <select value={formData.location_type} onChange={(e) => setFormData({...formData, location_type: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Recurrence</label>
            <select value={formData.recurrence_type}
              onChange={(e) => setFormData({...formData, recurrence_type: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="once">One-time session</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          {formData.recurrence_type !== 'once' && (
            <div>
              <label className="block text-sm font-medium mb-2">Number of Sessions</label>
              <input type="number" min="1" max="52" value={formData.num_sessions}
                onChange={(e) => setFormData({...formData, num_sessions: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-3 rounded-xl border outline-none"
                placeholder="e.g., 10 sessions" />
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
            {loading ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const CreatePaymentLinkModal = ({ isOpen, onClose, clients }) => {
  const [formData, setFormData] = useState({ client_id: '', amount: '', plan_id: 'custom' });
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    let result;
    
    if (formData.recurrence_type !== 'once') {
      const [date, time] = formData.scheduled_at.split('T');
      result = await api.createRecurringSessions({
        client_id: formData.client_id,
        recurrence_type: formData.recurrence_type,
        start_date: date,
        time: time || '09:00',
        num_sessions: formData.num_sessions,
        duration_minutes: formData.duration_minutes,
        location: formData.location_type
      });
    } else {
      result = await api.createSession(formData);
    }
    
    if (result.success) {
      alert(result.message || 'Session(s) created!');
      onSuccess();
      onClose();
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Payment Link">
      {!paymentLink ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Client *</label>
            <select required value={formData.client_id} onChange={(e) => setFormData({...formData, client_id: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
            <input type="number" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            {loading ? 'Creating...' : 'Generate Link'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-xl"><a href={paymentLink} target="_blank" className="text-blue-600 underline break-all">{paymentLink}</a></div>
          <button onClick={() => { navigator.clipboard.writeText(paymentLink); alert('Copied!'); }} className="w-full px-4 py-3 rounded-xl bg-slate-100">Copy Link</button>
        </div>
      )}
    </Modal>
  );
};

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

const Sidebar = ({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const items = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'clients', icon: Users, label: 'Clients' },
    { id: 'sessions', icon: Calendar, label: 'Sessions' },
    { id: 'workouts', icon: Dumbbell, label: 'Workouts' },
    { id: 'coaches', icon: UserPlus, label: 'Coaches' },
    { id: 'payments', icon: DollarSign, label: 'Payments' },
    { id: 'referrals', icon: Share2, label: 'Referrals' },
  ];

  return (
    <>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={`fixed lg:sticky top-0 left-0 h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white w-72 flex flex-col z-50 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💪</div>
            <div><h2 className="font-bold text-lg">FitLife Coaching</h2></div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden ml-auto"><X size={20} /></button>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'hover:bg-white/5'}`}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
};

const Header = ({ setIsMobileMenuOpen }) => (
  <header className="bg-white border-b sticky top-0 z-30">
    <div className="px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden"><Menu size={24} /></button>
        <div><h1 className="text-2xl font-bold">Welcome Back! 👋</h1></div>
      </div>
      <button className="relative p-2 hover:bg-slate-100 rounded-xl"><Bell size={20} /></button>
    </div>
  </header>
);

const StatCard = ({ icon: Icon, label, value, color = 'orange' }) => {
  const colors = { orange: 'from-orange-500 to-red-500', blue: 'from-blue-500 to-indigo-500', green: 'from-green-500 to-emerald-500', purple: 'from-purple-500 to-pink-500' };
  return (
    <div className="bg-white rounded-2xl p-6 border hover:shadow-lg transition-all">
      <div className="flex items-start justify-between">
        <div><p className="text-sm font-medium text-slate-600 mb-1">{label}</p><p className="text-3xl font-bold">{value}</p></div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} shadow-lg`}><Icon size={24} className="text-white" /></div>
      </div>
    </div>
  );
};

// ============================================================================
// VIEWS
// ============================================================================

const Dashboard = ({ clients, sessions, stats }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard icon={Users} label="Total Clients" value={stats?.total_clients || clients.length} color="orange" />
      <StatCard icon={Calendar} label="Sessions" value={stats?.total_sessions || sessions.length} color="blue" />
      <StatCard icon={CheckCircle} label="Completed" value={stats?.completed_sessions || 0} color="green" />
      <StatCard icon={DollarSign} label="Revenue" value={`₹${(stats?.total_revenue || 0).toFixed(0)}`} color="purple" />
    </div>
    <div className="bg-white rounded-2xl border p-6">
      <h2 className="text-xl font-bold mb-4">Recent Sessions</h2>
      <div className="space-y-3">
        {sessions.slice(0, 5).map((s, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">{s.client_name?.charAt(0)}</div>
            <div className="flex-1"><p className="font-semibold">{s.client_name}</p><p className="text-sm text-slate-600">{s.template_name || 'Session'}</p></div>
            <div className="text-right"><p className="text-sm font-medium capitalize">{s.status}</p></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ClientsView = ({ clients, onRefresh }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddEnhancedModalOpen, setIsAddEnhancedModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Client Management</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsAddModalOpen(true)} 
            className="bg-slate-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-700 transition-colors">
            <Plus size={20} />Quick Add
          </button>
          <button onClick={() => setIsAddEnhancedModalOpen(true)} 
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-all">
            <Plus size={20} />Add Full Profile
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {clients.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border p-6 hover:shadow-xl transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-xl font-bold">{c.name.charAt(0)}</div>
              <div className="flex-1">
                <h3 className="font-bold">{c.name}</h3>
                <p className="text-sm text-slate-500">{c.sessions} sessions</p>
              </div>
              <button onClick={() => setSelectedClient(c)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-100 rounded-lg"
                title="View Details">
                <Eye size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-2"><span className="text-sm font-medium">Progress</span><span className="text-sm font-bold">{c.progress}%</span></div>
              <div className="w-full bg-slate-200 rounded-full h-2.5"><div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" style={{width: `${c.progress}%`}} /></div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-medium text-slate-600">Grade</span>
              <span className="text-lg font-bold text-orange-600">{c.overall_grade}</span>
            </div>
          </div>
        ))}
      </div>

      <AddClientModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={onRefresh} />
      <AddClientEnhancedModal isOpen={isAddEnhancedModalOpen} onClose={() => setIsAddEnhancedModalOpen(false)} onSuccess={onRefresh} />
      <ClientDetailModal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} client={selectedClient} />
    </div>
  );
};

const SessionsView = ({ sessions, clients, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sessions</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
          <Plus size={20} />Schedule Session
        </button>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">Client</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Date & Time</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sessions.map((s, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">{s.client_name?.charAt(0)}</div><span className="font-medium">{s.client_name}</span></div></td>
                <td className="px-6 py-4 text-sm">{new Date(s.scheduled_at).toLocaleString()}</td>
                <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScheduleSessionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={onRefresh} clients={clients} />
    </div>
  );
};

const WorkoutsView = () => {
  const [workouts, setWorkouts] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [clients, setClients] = useState([]);

  const loadWorkouts = async () => {
    const result = await api.getWorkouts(filter === 'all' ? null : filter);
    if (result.success) setWorkouts(result.workouts);
  };

  const loadClients = async () => {
    const result = await api.getClients();
    if (result.success) setClients(result.clients);
  };

  useEffect(() => { loadWorkouts(); loadClients(); }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">📚 Workout Library</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsAssignModalOpen(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
            <CheckCircle size={20} />Assign to Client
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
            <Plus size={20} />Add Workout
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'yoga', 'gym', 'cardio', 'hiit', 'nutrition', 'pilates'].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              filter === cat ? 'bg-purple-500 text-white shadow-lg' : 'bg-white border hover:border-purple-500'
            }`}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {workouts.map(w => (
          <div key={w.id} className="bg-white rounded-2xl border p-6 hover:shadow-xl transition-all group">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{w.category}</span>
                <div className="flex items-center gap-2 text-sm text-slate-500"><Clock size={16} />{w.duration_minutes} min</div>
              </div>
              <h3 className="font-bold text-lg mb-2 group-hover:text-purple-600 transition-colors">{w.name}</h3>
              <p className="text-sm text-slate-600 line-clamp-2">{w.description}</p>
            </div>
            <div className="pt-4 border-t flex items-center justify-between text-sm">
              <span className="text-slate-500">By: {w.created_by_name || 'Coach'}</span>
              <span className="font-medium text-purple-600">{w.times_used || 0} uses</span>
            </div>
          </div>
        ))}
        {workouts.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500">
            <Dumbbell size={48} className="mx-auto mb-4 opacity-50" />
            <p>No workouts in this category yet. Add your first workout!</p>
          </div>
        )}
      </div>

      <AddWorkoutModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadWorkouts} />
      <AssignWorkoutModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onSuccess={loadWorkouts} clients={clients} workouts={workouts} />
    </div>
  );
};

const CoachesView = () => {
  const [coaches, setCoaches] = useState([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCoaches = async () => {
    setLoading(true);
    try {
      const result = await api.getCoaches();
      if (result.success) setCoaches(result.coaches);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCoaches(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">👥 Coach Management</h2>
        <button onClick={() => setIsRegisterModalOpen(true)} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg">
          <UserPlus size={20} />Register New Coach
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {coaches.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border p-6 hover:shadow-xl transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold">{c.full_name.charAt(0)}</div>
                <div>
                  <h3 className="font-bold text-lg">{c.full_name}</h3>
                  <p className="text-sm text-slate-500">{c.email}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                  <span className="text-slate-600">Specialization</span>
                  <span className="font-medium text-purple-700 capitalize">
                    {typeof c.metadata === 'string' ? JSON.parse(c.metadata).specialization : c.metadata?.specialization || 'General'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Total Sessions</span>
                  <span className="font-medium">{c.total_sessions || 0}</span>
                </div>
              </div>
            </div>
          ))}
          {coaches.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-500">
              <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
              <button onClick={() => setIsRegisterModalOpen(true)} className="text-purple-600 hover:underline">Register your first coach</button>
            </div>
          )}
        </div>
      )}

      <CoachRegistrationModal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} onSuccess={loadCoaches} />
    </div>
  );
};

const PaymentsView = ({ clients }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Payments</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
          <CreditCard size={20} />Create Payment Link
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <StatCard icon={DollarSign} label="Total Revenue" value="₹48.5K" color="green" />
        <StatCard icon={CheckCircle} label="Paid" value="12" color="blue" />
        <StatCard icon={Clock} label="Pending" value="3" color="orange" />
      </div>
      <CreatePaymentLinkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} clients={clients} />
    </div>
  );
};

const ReferralsView = () => {
  const [referrals, setReferrals] = useState([]);
  useEffect(() => { api.getReferrals().then(r => r.success && setReferrals(r.referrals)); }, []);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Referral Program</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <StatCard icon={Share2} label="Total" value={referrals.length} color="purple" />
        <StatCard icon={CheckCircle} label="Converted" value={referrals.filter(r => r.status === 'converted').length} color="green" />
        <StatCard icon={Clock} label="Pending" value={referrals.filter(r => r.status === 'pending').length} color="orange" />
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, s, st] = await Promise.all([api.getClients(), api.getSessions(), api.getDashboardStats()]);
      if (c.success) setClients(c.clients);
      if (s.success) setSessions(s.sessions);
      if (st.success) setStats(st.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const renderContent = () => {
    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>;
    switch (activeTab) {
      case 'dashboard': return <Dashboard clients={clients} sessions={sessions} stats={stats} />;
      case 'clients': return <ClientsView clients={clients} onRefresh={loadData} />;
      case 'sessions': return <SessionsView sessions={sessions} clients={clients} onRefresh={loadData} />;
      case 'workouts': return <WorkoutsView />;
      case 'coaches': return <CoachesView />;
      case 'payments': return <PaymentsView clients={clients} />;
      case 'referrals': return <ReferralsView />;
      default: return <Dashboard clients={clients} sessions={sessions} stats={stats} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <main className="flex-1 p-6 overflow-auto"><div className="max-w-7xl mx-auto">{renderContent()}</div></main>
      </div>
    </div>
  );
}

export default App;
