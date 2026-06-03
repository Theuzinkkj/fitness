const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// PROFILE
router.get('/profile', async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', req.user.id).single();
  if (error && error.code !== 'PGRST116') return res.status(400).json({ error: error.message });
  res.json(data || null);
});
router.put('/profile', async (req, res) => {
  const { data, error } = await supabase.from('profiles')
    .upsert({ ...req.body, id: req.user.id, email: req.user.email, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

function pick(body, keys) {
  return keys.reduce((out, key) => {
    if (body[key] !== undefined) out[key] = body[key];
    return out;
  }, {});
}

function collectionRoutes(path, table, keys, order = 'created_at') {
  router.get(path, async (req, res) => {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', req.user.id).order(order, { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  router.post(path, async (req, res) => {
    const payload = pick(req.body, ['id', ...keys]);
    if (!payload.id) payload.id = `${table}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase.from(table).insert({ ...payload, user_id: req.user.id }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  });

  router.put(`${path}/:id`, async (req, res) => {
    const payload = pick(req.body, keys);
    const { data, error } = await supabase.from(table)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  router.delete(`${path}/:id`, async (req, res) => {
    const { error } = await supabase.from(table).delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Excluido' });
  });
}

collectionRoutes('/habits', 'fitness_habits', ['name', 'icon', 'period', 'checks']);
collectionRoutes('/tasks', 'fitness_tasks', ['title', 'due', 'done'], 'due');
collectionRoutes('/goals-fit', 'fitness_goals', ['title', 'category', 'photo', 'start', 'deadline', 'archived'], 'deadline');

// WORKOUTS
router.get('/workouts', async (req, res) => {
  const { data, error } = await supabase.from('workouts').select('*, exercises(*)').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
router.post('/workouts', async (req, res) => {
  const { exercises, ...workout } = req.body;
  const { data, error } = await supabase.from('workouts').insert({ ...workout, user_id: req.user.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (exercises?.length) await supabase.from('exercises').insert(exercises.map((e, i) => ({ ...e, workout_id: data.id, order_index: i })));
  res.status(201).json(data);
});
router.put('/workouts/:id', async (req, res) => {
  const { exercises, ...workout } = req.body;
  const { data, error } = await supabase.from('workouts').update({ ...workout, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (exercises) { await supabase.from('exercises').delete().eq('workout_id', req.params.id); if (exercises.length) await supabase.from('exercises').insert(exercises.map((e, i) => ({ ...e, workout_id: req.params.id, order_index: i }))); }
  res.json(data);
});
router.delete('/workouts/:id', async (req, res) => {
  await supabase.from('exercises').delete().eq('workout_id', req.params.id);
  const { error } = await supabase.from('workouts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Excluído' });
});

// WORKOUT LOGS
router.get('/workout-logs', async (req, res) => {
  const { date } = req.query;
  let q = supabase.from('workout_logs').select('*, exercise_logs(*)').eq('user_id', req.user.id).order('date', { ascending: false }).limit(50);
  if (date) q = q.eq('date', date);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
router.post('/workout-logs', async (req, res) => {
  const { exercise_logs, ...log } = req.body;
  const { data, error } = await supabase.from('workout_logs').insert({ ...log, user_id: req.user.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (exercise_logs?.length) await supabase.from('exercise_logs').insert(exercise_logs.map(e => ({ ...e, workout_log_id: data.id })));
  res.status(201).json(data);
});
router.put('/workout-logs/:id', async (req, res) => {
  const { data, error } = await supabase.from('workout_logs').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
router.delete('/workout-logs/:id', async (req, res) => {
  const { error } = await supabase.from('workout_logs').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Excluído' });
});

// MEALS
router.get('/meals', async (req, res) => {
  const { date } = req.query;
  let q = supabase.from('meals').select('*, food_items(*)').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (date) q = q.eq('date', date);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
router.post('/meals', async (req, res) => {
  const { food_items, ...meal } = req.body;
  const { data, error } = await supabase.from('meals').insert({ ...meal, user_id: req.user.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (food_items?.length) await supabase.from('food_items').insert(food_items.map(f => ({ ...f, meal_id: data.id })));
  res.status(201).json(data);
});
router.delete('/meals/:id', async (req, res) => {
  await supabase.from('food_items').delete().eq('meal_id', req.params.id);
  const { error } = await supabase.from('meals').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Excluído' });
});

// WATER
router.get('/water', async (req, res) => {
  const { date } = req.query;
  let q = supabase.from('water_logs').select('*').eq('user_id', req.user.id).order('logged_at', { ascending: false });
  if (date) q = q.eq('date', date);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
router.post('/water', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('water_logs').insert({ ...req.body, user_id: req.user.id, date: req.body.date || today, logged_at: new Date().toISOString() }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});
router.delete('/water/:id', async (req, res) => {
  const { error } = await supabase.from('water_logs').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Excluído' });
});

// MEASUREMENTS
router.get('/measurements', async (req, res) => {
  const { data, error } = await supabase.from('body_measurements').select('*').eq('user_id', req.user.id).order('date', { ascending: false }).limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
router.post('/measurements', async (req, res) => {
  const { data, error } = await supabase.from('body_measurements').insert({ ...req.body, user_id: req.user.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});
router.delete('/measurements/:id', async (req, res) => {
  const { error } = await supabase.from('body_measurements').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Excluído' });
});

// DAILY SUMMARY
router.get('/daily-summary', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const uid = req.user.id;
  const [meals, water, workoutLogs] = await Promise.all([
    supabase.from('meals').select('total_calories,total_protein,total_carbs,total_fat').eq('user_id', uid).eq('date', date),
    supabase.from('water_logs').select('amount_ml').eq('user_id', uid).eq('date', date),
    supabase.from('workout_logs').select('completed,duration_minutes').eq('user_id', uid).eq('date', date)
  ]);
  res.json({
    date,
    calories: (meals.data||[]).reduce((a,m)=>a+(m.total_calories||0),0),
    protein:  (meals.data||[]).reduce((a,m)=>a+(m.total_protein||0),0),
    carbs:    (meals.data||[]).reduce((a,m)=>a+(m.total_carbs||0),0),
    fat:      (meals.data||[]).reduce((a,m)=>a+(m.total_fat||0),0),
    waterMl:  (water.data||[]).reduce((a,w)=>a+(w.amount_ml||0),0),
    workoutsCompleted: (workoutLogs.data||[]).filter(w=>w.completed).length,
    workoutsTotal: (workoutLogs.data||[]).length
  });
});

module.exports = router;
