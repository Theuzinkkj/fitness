-- ================================================
-- HUB PESSOAL — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- ATLAS HUB (Produtividade)
-- ================================================

CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Sem título',
  content    TEXT DEFAULT '',
  category   TEXT DEFAULT '',
  tags       TEXT[] DEFAULT '{}',
  pinned     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  priority     TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date     DATE,
  done         BOOLEAN DEFAULT FALSE,
  category     TEXT DEFAULT '',
  description  TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  timeline    TEXT DEFAULT 'medium' CHECK (timeline IN ('short','medium','long')),
  deadline    DATE,
  progress    INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed   BOOLEAN DEFAULT FALSE,
  history     JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  time        TEXT,
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  mood       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS links (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT DEFAULT '',
  category    TEXT DEFAULT '',
  emoji       TEXT DEFAULT '',
  description TEXT DEFAULT '',
  favorite    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS library_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  type         TEXT DEFAULT 'book' CHECK (type IN ('book','course','video','article')),
  status       TEXT DEFAULT 'todo' CHECK (status IN ('todo','reading','done')),
  author       TEXT DEFAULT '',
  url          TEXT DEFAULT '',
  progress     INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  rating       INTEGER DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  notes        TEXT DEFAULT '',
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_config (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  master_hash TEXT NOT NULL,
  salt        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service      TEXT NOT NULL,
  login        TEXT NOT NULL,
  enc_password TEXT NOT NULL,
  url          TEXT DEFAULT '',
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_subjects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#6366f1',
  reviews     JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES study_subjects(id) ON DELETE SET NULL,
  duration   INTEGER NOT NULL DEFAULT 0,
  content    TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  detail     TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_folders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  parent     UUID REFERENCES file_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files_metadata (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  size         BIGINT DEFAULT 0,
  type         TEXT DEFAULT '',
  folder       UUID REFERENCES file_folders(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url   TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings   JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- FITHUB (Fitness)
-- ================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT,
  email              TEXT,
  avatar_url         TEXT,
  age                INTEGER,
  sex                TEXT CHECK (sex IN ('masculino','feminino','outro')),
  height             NUMERIC(5,1),
  weight             NUMERIC(5,1),
  goal               TEXT CHECK (goal IN ('emagrecimento','hipertrofia','manutencao','performance')),
  experience_level   TEXT CHECK (experience_level IN ('iniciante','intermediario','avancado')),
  available_days     TEXT[] DEFAULT '{}',
  food_restrictions  TEXT[] DEFAULT '{}',
  daily_calorie_goal INTEGER DEFAULT 2000,
  daily_protein_goal INTEGER DEFAULT 150,
  daily_carb_goal    INTEGER DEFAULT 250,
  daily_fat_goal     INTEGER DEFAULT 65,
  daily_water_goal   NUMERIC(3,1) DEFAULT 2.5,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT DEFAULT '',
  muscle_groups      TEXT[] DEFAULT '{}',
  type               TEXT DEFAULT 'personalizado',
  estimated_duration INTEGER,
  is_template        BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercises (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id   UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  muscle_group TEXT DEFAULT '',
  sets         INTEGER DEFAULT 3,
  reps         TEXT DEFAULT '10',
  weight       NUMERIC(6,1),
  rest_seconds INTEGER DEFAULT 60,
  notes        TEXT DEFAULT '',
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id       UUID REFERENCES workouts(id) ON DELETE SET NULL,
  workout_name     TEXT NOT NULL,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  notes            TEXT DEFAULT '',
  completed        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_name  TEXT NOT NULL,
  muscle_group   TEXT DEFAULT '',
  sets_completed INTEGER,
  reps_completed TEXT,
  weight         NUMERIC(6,1),
  notes          TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  meal_type      TEXT DEFAULT 'lanche' CHECK (meal_type IN ('cafe_da_manha','almoco','jantar','lanche','pre_treino','pos_treino')),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  total_calories NUMERIC(7,1) DEFAULT 0,
  total_protein  NUMERIC(6,1) DEFAULT 0,
  total_carbs    NUMERIC(6,1) DEFAULT 0,
  total_fat      NUMERIC(6,1) DEFAULT 0,
  notes          TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_items (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id   UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  quantity  NUMERIC(7,1) DEFAULT 100,
  unit      TEXT DEFAULT 'g',
  calories  NUMERIC(7,1) DEFAULT 0,
  protein   NUMERIC(6,1) DEFAULT 0,
  carbs     NUMERIC(6,1) DEFAULT 0,
  fat       NUMERIC(6,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS water_logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_ml INTEGER NOT NULL DEFAULT 200,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS body_measurements (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  weight              NUMERIC(5,1),
  body_fat_percentage NUMERIC(4,1),
  chest               NUMERIC(5,1),
  waist               NUMERIC(5,1),
  hips                NUMERIC(5,1),
  left_arm            NUMERIC(5,1),
  right_arm           NUMERIC(5,1),
  left_thigh          NUMERIC(5,1),
  right_thigh         NUMERIC(5,1),
  left_calf           NUMERIC(5,1),
  right_calf          NUMERIC(5,1),
  notes               TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fitness_habits (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT DEFAULT 'H',
  period     TEXT DEFAULT 'DIA',
  checks     JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fitness_tasks (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due        DATE NOT NULL DEFAULT CURRENT_DATE,
  done       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fitness_goals (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  category   TEXT DEFAULT 'PESSOAL',
  photo      TEXT DEFAULT '',
  start      DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline   DATE NOT NULL DEFAULT CURRENT_DATE,
  archived   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- ÍNDICES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_notes_user        ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user        ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due         ON todos(due_date) WHERE done = FALSE;
CREATE INDEX IF NOT EXISTS idx_goals_user        ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_date  ON events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_diary_user_date   ON diary_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_links_user        ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_library_user      ON library_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_user        ON vault_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sess_user   ON study_sessions(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_workouts_user     ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_wlogs_user_date   ON workout_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meals_user_date   ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_water_user_date   ON water_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_measures_user     ON body_measurements(user_id, date);
CREATE INDEX IF NOT EXISTS idx_fit_habits_user   ON fitness_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_fit_tasks_user    ON fitness_tasks(user_id, due);
CREATE INDEX IF NOT EXISTS idx_fit_goals_user    ON fitness_goals(user_id, archived);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

DO $$ DECLARE t TEXT;
DECLARE atlas_tables TEXT[] := ARRAY['notes','todos','goals','events','diary_entries','links','library_items','vault_config','vault_entries','study_subjects','study_sessions','activity_log','file_folders','files_metadata','user_settings'];
DECLARE fit_tables TEXT[] := ARRAY['workouts','workout_logs','meals','water_logs','body_measurements','fitness_habits','fitness_tasks','fitness_goals'];
BEGIN
  FOREACH t IN ARRAY atlas_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_policy" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "%s_policy" ON %I USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());', t, t);
  END LOOP;
  FOREACH t IN ARRAY fit_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_policy" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "%s_policy" ON %I USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());', t, t);
  END LOOP;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_policy" ON profiles;
CREATE POLICY "profiles_policy" ON profiles USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "exercises_policy" ON exercises;
CREATE POLICY "exercises_policy" ON exercises USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "exercise_logs_policy" ON exercise_logs;
CREATE POLICY "exercise_logs_policy" ON exercise_logs USING (workout_log_id IN (SELECT id FROM workout_logs WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "food_items_policy" ON food_items;
CREATE POLICY "food_items_policy" ON food_items USING (meal_id IN (SELECT id FROM meals WHERE user_id = auth.uid()));

ALTER TABLE exercises       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items      ENABLE ROW LEVEL SECURITY;

-- Auto-criar perfil ao registrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================
-- SUPABASE STORAGE (execute no Dashboard)
-- ================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('atlas-files', 'atlas-files', true);
