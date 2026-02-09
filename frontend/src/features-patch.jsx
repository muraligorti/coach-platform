// Add these new modals and views to App.jsx

// Coach Registration Modal (add after other modals)
const CoachRegistrationModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    specialization: 'gym',
    bio: '',
    experience_years: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.request('/coaches/register', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (result.success) {
        alert('Coach registered successfully!');
        onSuccess(result);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const categories = ['yoga', 'gym', 'cardio', 'nutrition', 'pilates', 'crossfit', 'other'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register as Coach" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name *</label>
          <input type="text" required value={formData.full_name} 
            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input type="email" required value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>
            <input type="tel" required value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input type="password" value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Specialization *</label>
            <select value={formData.specialization}
              onChange={(e) => setFormData({...formData, specialization: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none">
              {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Experience (years)</label>
            <input type="number" value={formData.experience_years}
              onChange={(e) => setFormData({...formData, experience_years: parseInt(e.target.value)})}
              className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bio</label>
          <textarea value={formData.bio}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border outline-none" rows={3} />
        </div>

        <button type="submit" disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium">
          {loading ? 'Registering...' : 'Register as Coach'}
        </button>
      </form>
    </Modal>
  );
};

// Add Workout Modal
const AddWorkoutModal = ({ isOpen, onClose, onSuccess, coachId }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'gym',
    difficulty_level: 'intermediate',
    duration_minutes: 60,
    equipment_needed: [],
    tags: []
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.request(`/workouts/library?coach_id=${coachId}`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (result.success) {
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
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
            placeholder="HIIT Full Body Workout" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border outline-none" rows={3}
            placeholder="High intensity interval training..." />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border outline-none">
              <option value="yoga">Yoga 🧘</option>
              <option value="gym">Gym 🏋️</option>
              <option value="cardio">Cardio 🏃</option>
              <option value="hiit">HIIT ⚡</option>
              <option value="nutrition">Nutrition 🥗</option>
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
              onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
              className="w-full px-4 py-3 rounded-xl border outline-none" />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium">
          {loading ? 'Adding...' : 'Add to Library'}
        </button>
      </form>
    </Modal>
  );
};

// Workouts Library View
const WorkoutsView = ({ coachId }) => {
  const [workouts, setWorkouts] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadWorkouts = async () => {
    const result = await api.request('/workouts/library');
    if (result.success) setWorkouts(result.workouts);
  };

  useEffect(() => { loadWorkouts(); }, []);

  const filteredWorkouts = filter === 'all' ? workouts : workouts.filter(w => w.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Workout Library</h2>
        <button onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
          <Plus size={20} />Add Workout
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'yoga', 'gym', 'cardio', 'hiit', 'nutrition'].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap ${
              filter === cat ? 'bg-purple-500 text-white' : 'bg-white border'
            }`}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {filteredWorkouts.map(w => (
          <div key={w.id} className="bg-white rounded-2xl border p-6 hover:shadow-xl transition-all">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {w.category}
                </span>
                <span className="text-sm text-slate-500">{w.duration_minutes} min</span>
              </div>
              <h3 className="font-bold text-lg mb-2">{w.name}</h3>
              <p className="text-sm text-slate-600 line-clamp-2">{w.description}</p>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>By: {w.created_by_name}</span>
              <span>{w.times_used} uses</span>
            </div>
          </div>
        ))}
      </div>

      <AddWorkoutModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} 
        onSuccess={loadWorkouts} coachId={coachId} />
    </div>
  );
};
