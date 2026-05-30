import { createClient } from '@/lib/supabase/server'
import { DashboardView } from './dashboard-view'
import { getTodayString } from '@/lib/utils'

function calculateStreak(logs: { date: string; completed: boolean }[]): number {
  const completedDates = [...new Set(logs.filter(l => l.completed).map(l => l.date))].sort().reverse()
  if (completedDates.length === 0) return 0

  const today = getTodayString()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (completedDates[0] !== today && completedDates[0] !== yesterdayStr) return 0

  let streak = 1
  for (let i = 1; i < completedDates.length; i++) {
    const prev = new Date(completedDates[i - 1] + 'T12:00:00')
    const curr = new Date(completedDates[i] + 'T12:00:00')
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 1) streak++
    else break
  }
  return streak
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getTodayString()

  const [
    { data: profile },
    { data: todayMeals },
    { data: todayWater },
    { data: todayWorkouts },
    { data: recentWorkouts },
    { data: lastMeasurement },
    { data: streakLogs },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('meals').select('total_calories, total_protein, total_carbs, total_fat').eq('user_id', user.id).eq('date', today),
    supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('date', today),
    supabase.from('workout_logs').select('id, workout_name, duration_minutes, completed').eq('user_id', user.id).eq('date', today),
    supabase.from('workout_logs').select('id, workout_name, date, duration_minutes, completed').eq('user_id', user.id).order('date', { ascending: false }).limit(5),
    supabase.from('body_measurements').select('weight, body_fat_percentage, date').eq('user_id', user.id).order('date', { ascending: false }).limit(1).single(),
    supabase.from('workout_logs').select('date, completed').eq('user_id', user.id).order('date', { ascending: false }).limit(365),
  ])

  const calories = todayMeals?.reduce((sum, m) => sum + m.total_calories, 0) ?? 0
  const protein = todayMeals?.reduce((sum, m) => sum + m.total_protein, 0) ?? 0
  const carbs = todayMeals?.reduce((sum, m) => sum + m.total_carbs, 0) ?? 0
  const fat = todayMeals?.reduce((sum, m) => sum + m.total_fat, 0) ?? 0
  const waterMl = todayWater?.reduce((sum, w) => sum + w.amount_ml, 0) ?? 0
  const streak = calculateStreak(streakLogs ?? [])

  return (
    <DashboardView
      profile={profile}
      stats={{ calories, protein, carbs, fat, waterMl }}
      todayWorkouts={todayWorkouts ?? []}
      recentWorkouts={recentWorkouts ?? []}
      lastMeasurement={lastMeasurement}
      streak={streak}
    />
  )
}
