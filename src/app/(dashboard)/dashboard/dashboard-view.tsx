'use client'

import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Profile } from '@/types'
import { formatDate, calculateBMI } from '@/lib/utils'
import {
  Flame, Droplets, Dumbbell, Target,
  Beef, Wheat, Zap, CheckCircle2, Clock, ArrowRight, Scale
} from 'lucide-react'
import Link from 'next/link'
import { WaterTracker } from '@/components/dashboard/water-tracker'

interface DashboardViewProps {
  profile: Profile | null
  stats: {
    calories: number
    protein: number
    carbs: number
    fat: number
    waterMl: number
  }
  todayWorkouts: Array<{ id: string; workout_name: string; duration_minutes: number | null; completed: boolean }>
  recentWorkouts: Array<{ id: string; workout_name: string; date: string; duration_minutes: number | null; completed: boolean }>
  lastMeasurement: { weight: number | null; body_fat_percentage: number | null; date: string } | null
  streak: number
}

export function DashboardView({ profile, stats, todayWorkouts, recentWorkouts, lastMeasurement, streak }: DashboardViewProps) {
  const calorieGoal = profile?.daily_calorie_goal ?? 2000
  const proteinGoal = profile?.daily_protein_goal ?? 150
  const carbGoal = profile?.daily_carb_goal ?? 250
  const fatGoal = profile?.daily_fat_goal ?? 65
  const waterGoalLiters = profile?.daily_water_goal ?? 2.5
  const waterGoalMl = waterGoalLiters * 1000
  const waterConsumedLiters = stats.waterMl / 1000

  const caloriesRemaining = Math.max(0, calorieGoal - stats.calories)
  const firstName = profile?.name?.split(' ')[0] ?? 'Atleta'
  const currentWeight = lastMeasurement?.weight ?? profile?.weight
  const bmi = currentWeight && profile?.height ? calculateBMI(currentWeight, profile.height) : null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar title="Dashboard" />

      <div className="flex-1 p-4 lg:p-6 space-y-6">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {greeting}, {firstName}!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {formatDate(new Date())} • Vamos fazer acontecer!
            </p>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full">
                <span className="text-base">🔥</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak}</span>
                <span className="text-xs text-orange-500 dark:text-orange-500 hidden sm:inline">
                  {streak === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            )}
            {profile?.goal && (
              <Badge variant="default" className="hidden sm:flex">
                🎯 {profile.goal === 'hipertrofia' ? 'Hipertrofia' : profile.goal === 'emagrecimento' ? 'Emagrecimento' : profile.goal === 'manutencao' ? 'Manutenção' : 'Performance'}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Flame className="w-5 h-5 text-orange-500" />}
            label="Calorias"
            value={`${Math.round(stats.calories)}`}
            unit={`/ ${calorieGoal} kcal`}
            progress={(stats.calories / calorieGoal) * 100}
            color="bg-orange-500"
            sub={`${Math.round(caloriesRemaining)} restantes`}
          />
          <StatCard
            icon={<Droplets className="w-5 h-5 text-blue-500" />}
            label="Hidratação"
            value={waterConsumedLiters.toFixed(1)}
            unit={`/ ${waterGoalLiters}L`}
            progress={(stats.waterMl / waterGoalMl) * 100}
            color="bg-blue-500"
            sub={`${stats.waterMl}ml consumido`}
          />
          <StatCard
            icon={<Dumbbell className="w-5 h-5 text-purple-500" />}
            label="Treinos Hoje"
            value={`${todayWorkouts.filter(w => w.completed).length}`}
            unit={`/ ${todayWorkouts.length}`}
            progress={todayWorkouts.length > 0 ? (todayWorkouts.filter(w => w.completed).length / todayWorkouts.length) * 100 : 0}
            color="bg-purple-500"
            sub={todayWorkouts.length === 0 ? 'Nenhum agendado' : 'completado'}
          />
          <StatCard
            icon={<Scale className="w-5 h-5 text-emerald-500" />}
            label="Peso Atual"
            value={currentWeight ? `${currentWeight}` : '--'}
            unit="kg"
            progress={0}
            color="bg-emerald-500"
            sub={bmi ? `IMC: ${bmi.toFixed(1)}` : 'Registre seu peso'}
            noProgress
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Macros */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Nutrição de Hoje</CardTitle>
                  <Link href="/alimentacao">
                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                      Ver tudo <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <MacroBar
                    icon={<Beef className="w-4 h-4" />}
                    label="Proteína"
                    value={Math.round(stats.protein)}
                    goal={proteinGoal}
                    color="bg-red-500"
                    unit="g"
                  />
                  <MacroBar
                    icon={<Wheat className="w-4 h-4" />}
                    label="Carboidratos"
                    value={Math.round(stats.carbs)}
                    goal={carbGoal}
                    color="bg-yellow-500"
                    unit="g"
                  />
                  <MacroBar
                    icon={<Zap className="w-4 h-4" />}
                    label="Gorduras"
                    value={Math.round(stats.fat)}
                    goal={fatGoal}
                    color="bg-emerald-500"
                    unit="g"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Recent Workouts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Treinos Recentes</CardTitle>
                  <Link href="/treinos">
                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                      Ver todos <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentWorkouts.length === 0 ? (
                  <div className="text-center py-8">
                    <Dumbbell className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum treino registrado</p>
                    <Link href="/treinos">
                      <Button size="sm" className="mt-3">Criar primeiro treino</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentWorkouts.map(workout => (
                      <div key={workout.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          {workout.completed
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            : <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                          }
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{workout.workout_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(workout.date)}</p>
                          </div>
                        </div>
                        {workout.duration_minutes && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            {workout.duration_minutes}min
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Water Tracker */}
            <WaterTracker currentMl={stats.waterMl} goalMl={waterGoalMl} />

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { href: '/treinos', label: 'Registrar Treino', icon: '💪' },
                  { href: '/alimentacao', label: 'Adicionar Refeição', icon: '🥗' },
                  { href: '/progresso', label: 'Registrar Peso', icon: '⚖️' },
                  { href: '/ia', label: 'Consultar IA', icon: '🤖' },
                ].map(({ href, label, icon }) => (
                  <Link key={href} href={href}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                      <span className="text-xl">{icon}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {label}
                      </span>
                      <ArrowRight className="w-4 h-4 ml-auto text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Goals */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Metas do Dia</CardTitle>
                  <Target className="w-4 h-4 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <GoalItem
                    label="Calorias"
                    done={stats.calories >= calorieGoal}
                    progress={(stats.calories / calorieGoal) * 100}
                  />
                  <GoalItem
                    label="Proteína"
                    done={stats.protein >= proteinGoal}
                    progress={(stats.protein / proteinGoal) * 100}
                  />
                  <GoalItem
                    label="Hidratação"
                    done={stats.waterMl >= waterGoalMl}
                    progress={(stats.waterMl / waterGoalMl) * 100}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, unit, progress, color, sub, noProgress }: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  progress: number
  color: string
  sub: string
  noProgress?: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="mb-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
        </div>
        {!noProgress && <Progress value={Math.min(progress, 100)} className="h-1.5 mb-2" indicatorClassName={color} />}
        <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
      </CardContent>
    </Card>
  )
}

function MacroBar({ icon, label, value, goal, color, unit }: {
  icon: React.ReactNode
  label: string
  value: number
  goal: number
  color: string
  unit: string
}) {
  const progress = Math.min((value / goal) * 100, 100)
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="relative w-16 h-16 mx-auto mb-2">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100 dark:text-gray-800" />
          <circle
            cx="32" cy="32" r="28" fill="none" strokeWidth="6"
            strokeDasharray={`${progress * 1.759} 175.9`}
            strokeLinecap="round"
            className={color.replace('bg-', 'stroke-')}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{Math.round(progress)}%</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}{unit}</p>
      <p className="text-xs text-gray-400">/ {goal}{unit}</p>
    </div>
  )
}

function GoalItem({ label, done, progress }: { label: string; done: boolean; progress: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500' : 'border-2 border-gray-200 dark:border-gray-700'}`}>
        {done && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-xs text-gray-500">{Math.round(Math.min(progress, 100))}%</span>
        </div>
        <Progress value={Math.min(progress, 100)} className="h-1" indicatorClassName={done ? 'bg-emerald-500' : 'bg-blue-500'} />
      </div>
    </div>
  )
}
