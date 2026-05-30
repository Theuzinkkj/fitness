import { createClient } from '@/lib/supabase/server'
import { TreinosView } from './treinos-view'

export default async function TreinosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: workouts }, { data: workoutLogs }] = await Promise.all([
    supabase.from('workouts').select('*, exercises(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('workout_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(30),
  ])

  return (
    <TreinosView
      workouts={workouts ?? []}
      workoutLogs={workoutLogs ?? []}
      userId={user.id}
    />
  )
}
