'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Workout, Exercise, WorkoutLog, MUSCLE_GROUP_LABELS, MuscleGroup } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatDate, getTodayString } from '@/lib/utils'
import {
  Plus, Dumbbell, Trash2, Edit, Play, Calendar,
  Clock, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle,
  Loader2, Timer, SkipForward, Flag, Pause, X
} from 'lucide-react'

interface TreinosViewProps {
  workouts: Workout[]
  workoutLogs: WorkoutLog[]
  userId: string
}

const MUSCLE_GROUPS: MuscleGroup[] = ['peito', 'costas', 'ombro', 'biceps', 'triceps', 'pernas', 'abdomen', 'gluteos', 'cardio']

const WORKOUT_FORM_DEFAULTS = {
  name: '', description: '', type: 'personalizado' as const, estimated_duration: '',
}
const EXERCISE_DEFAULTS = (): Partial<Exercise> => ({
  name: '', muscle_group: '', sets: 3, reps: '10', weight: undefined, rest_seconds: 60, order_index: 0
})

interface WorkoutExecution {
  workout: Workout
  startTime: Date
  exercises: Exercise[]
}

export function TreinosView({ workouts, workoutLogs, userId }: TreinosViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMutating, setIsMutating] = useState(false)
  const [activeTab, setActiveTab] = useState<'treinos' | 'historico'>('treinos')
  const [showNewWorkout, setShowNewWorkout] = useState(false)
  const [showLogWorkout, setShowLogWorkout] = useState<string | null>(null)
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Edit state
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null)
  const [editForm, setEditForm] = useState(WORKOUT_FORM_DEFAULTS)
  const [editExercises, setEditExercises] = useState<Partial<Exercise>[]>([])

  // New workout form
  const [newWorkout, setNewWorkout] = useState(WORKOUT_FORM_DEFAULTS)
  const [exercises, setExercises] = useState<Partial<Exercise>[]>([EXERCISE_DEFAULTS()])

  // Log workout form
  const [logData, setLogData] = useState({ duration_minutes: '', notes: '', completed: true })

  // Execution mode
  const [execution, setExecution] = useState<WorkoutExecution | null>(null)
  const [execIdx, setExecIdx] = useState(0)
  const [setsCompleted, setSetsCompleted] = useState(0)
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const refresh = () => startTransition(() => router.refresh())

  // Rest timer countdown
  useEffect(() => {
    if (restTimer === null || restTimer <= 0) {
      if (restTimer === 0) setRestTimer(null)
      return
    }
    const id = setTimeout(() => setRestTimer(t => (t !== null ? t - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [restTimer])

  // Elapsed time during execution
  useEffect(() => {
    if (!execution) { setElapsedSeconds(0); return }
    const id = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [execution])

  // --- New Workout ---
  async function createWorkout() {
    setIsMutating(true)
    const supabase = createClient()
    const { data: workout, error } = await supabase.from('workouts').insert({
      user_id: userId,
      name: newWorkout.name,
      description: newWorkout.description || null,
      type: newWorkout.type,
      estimated_duration: newWorkout.estimated_duration ? parseInt(newWorkout.estimated_duration) : null,
      muscle_groups: [...new Set(exercises.filter(e => e.muscle_group).map(e => e.muscle_group!))],
    }).select().single()

    if (!error && workout) {
      const validExercises = exercises.filter(e => e.name)
      if (validExercises.length > 0) {
        await supabase.from('exercises').insert(
          validExercises.map((e, i) => ({
            workout_id: workout.id,
            name: e.name!,
            muscle_group: e.muscle_group || null,
            sets: e.sets ?? 3,
            reps: e.reps ?? '10',
            weight: e.weight ?? null,
            rest_seconds: e.rest_seconds ?? 60,
            order_index: i,
          }))
        )
      }
    }

    setShowNewWorkout(false)
    setNewWorkout(WORKOUT_FORM_DEFAULTS)
    setExercises([EXERCISE_DEFAULTS()])
    setIsMutating(false)
    refresh()
  }

  // --- Edit Workout ---
  function startEdit(workout: Workout) {
    setEditingWorkout(workout)
    setEditForm({
      name: workout.name,
      description: workout.description ?? '',
      type: workout.type,
      estimated_duration: workout.estimated_duration?.toString() ?? '',
    })
    setEditExercises(
      (workout.exercises ?? []).sort((a, b) => a.order_index - b.order_index).map(e => ({ ...e }))
    )
  }

  async function updateWorkout() {
    if (!editingWorkout) return
    setIsMutating(true)
    const supabase = createClient()

    await supabase.from('workouts').update({
      name: editForm.name,
      description: editForm.description || null,
      type: editForm.type,
      estimated_duration: editForm.estimated_duration ? parseInt(editForm.estimated_duration) : null,
      muscle_groups: [...new Set(editExercises.filter(e => e.muscle_group).map(e => e.muscle_group!))],
    }).eq('id', editingWorkout.id)

    // Replace all exercises
    await supabase.from('exercises').delete().eq('workout_id', editingWorkout.id)
    const validExercises = editExercises.filter(e => e.name)
    if (validExercises.length > 0) {
      await supabase.from('exercises').insert(
        validExercises.map((e, i) => ({
          workout_id: editingWorkout.id,
          name: e.name!,
          muscle_group: e.muscle_group || null,
          sets: e.sets ?? 3,
          reps: e.reps ?? '10',
          weight: e.weight ?? null,
          rest_seconds: e.rest_seconds ?? 60,
          order_index: i,
        }))
      )
    }

    setEditingWorkout(null)
    setIsMutating(false)
    refresh()
  }

  // --- Delete Workout ---
  async function deleteWorkout(id: string) {
    setIsMutating(true)
    const supabase = createClient()
    await supabase.from('workouts').delete().eq('id', id)
    setDeleteConfirmId(null)
    setIsMutating(false)
    refresh()
  }

  // --- Log Workout (simple) ---
  async function logWorkout(workoutId: string, workoutName: string) {
    setIsMutating(true)
    const supabase = createClient()
    await supabase.from('workout_logs').insert({
      user_id: userId,
      workout_id: workoutId,
      workout_name: workoutName,
      date: getTodayString(),
      duration_minutes: logData.duration_minutes ? parseInt(logData.duration_minutes) : null,
      notes: logData.notes || null,
      completed: logData.completed,
    })
    setShowLogWorkout(null)
    setLogData({ duration_minutes: '', notes: '', completed: true })
    setIsMutating(false)
    refresh()
  }

  // --- Workout Execution Mode ---
  function startExecution(workout: Workout) {
    const sortedExercises = (workout.exercises ?? []).sort((a, b) => a.order_index - b.order_index)
    if (sortedExercises.length === 0) {
      setShowLogWorkout(workout.id)
      return
    }
    setExecution({ workout, startTime: new Date(), exercises: sortedExercises })
    setExecIdx(0)
    setSetsCompleted(0)
    setRestTimer(null)
    setElapsedSeconds(0)
  }

  function nextSet() {
    if (!execution) return
    const currentExercise = execution.exercises[execIdx]
    const newSets = setsCompleted + 1

    if (newSets < currentExercise.sets) {
      setSetsCompleted(newSets)
      setRestTimer(currentExercise.rest_seconds)
    } else {
      const nextIdx = execIdx + 1
      setRestTimer(currentExercise.rest_seconds)
      if (nextIdx < execution.exercises.length) {
        setExecIdx(nextIdx)
        setSetsCompleted(0)
      } else {
        finishExecution(true)
      }
    }
  }

  function skipExercise() {
    if (!execution) return
    const nextIdx = execIdx + 1
    if (nextIdx < execution.exercises.length) {
      setExecIdx(nextIdx)
      setSetsCompleted(0)
      setRestTimer(null)
    } else {
      finishExecution(true)
    }
  }

  async function finishExecution(completed = true) {
    if (!execution) return
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
    setIsMutating(true)
    const supabase = createClient()
    await supabase.from('workout_logs').insert({
      user_id: userId,
      workout_id: execution.workout.id,
      workout_name: execution.workout.name,
      date: getTodayString(),
      duration_minutes: durationMinutes,
      completed,
      notes: `Executado via modo de treino. ${execution.exercises.length} exercício(s).`,
    })
    setExecution(null)
    setExecIdx(0)
    setSetsCompleted(0)
    setRestTimer(null)
    setIsMutating(false)
    refresh()
  }

  // --- Exercise list helpers ---
  function addExercise(
    list: Partial<Exercise>[],
    setList: React.Dispatch<React.SetStateAction<Partial<Exercise>[]>>
  ) {
    setList(prev => [...prev, { ...EXERCISE_DEFAULTS(), order_index: prev.length }])
  }

  function updateExerciseField(
    index: number,
    field: string,
    value: string | number,
    setList: React.Dispatch<React.SetStateAction<Partial<Exercise>[]>>
  ) {
    setList(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  function removeExercise(
    index: number,
    setList: React.Dispatch<React.SetStateAction<Partial<Exercise>[]>>
  ) {
    setList(prev => prev.filter((_, i) => i !== index))
  }

  const tabs = [
    { id: 'treinos', label: 'Meus Treinos', count: workouts.length },
    { id: 'historico', label: 'Histórico', count: workoutLogs.length },
  ] as const

  // Execution dialog helpers
  const currentExercise = execution?.exercises[execIdx]
  const elapsedFormatted = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar title="Treinos" />

      <div className="flex-1 p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gestão de Treinos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Crie e acompanhe seus treinos</p>
          </div>
          <Button onClick={() => setShowNewWorkout(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Treino
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total de Treinos', value: workoutLogs.length, icon: <Dumbbell className="w-5 h-5 text-purple-500" /> },
            { label: 'Este Mês', value: workoutLogs.filter(l => l.date >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]).length, icon: <Calendar className="w-5 h-5 text-blue-500" /> },
          ].map(({ label, value, icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                {icon}
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Meus Treinos */}
        {activeTab === 'treinos' && (
          <div className="space-y-4">
            {workouts.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Dumbbell className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhum treino criado ainda</p>
                  <Button onClick={() => setShowNewWorkout(true)}>Criar meu primeiro treino</Button>
                </CardContent>
              </Card>
            ) : (
              workouts.map(workout => (
                <Card key={workout.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{workout.name}</CardTitle>
                          <Badge variant="secondary">{workout.type}</Badge>
                        </div>
                        {workout.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{workout.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {workout.muscle_groups?.map(mg => (
                            <Badge key={mg} variant="blue">{MUSCLE_GROUP_LABELS[mg as MuscleGroup] ?? mg}</Badge>
                          ))}
                          {workout.estimated_duration && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3" /> {workout.estimated_duration}min
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                        >
                          {expandedWorkout === workout.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => startEdit(workout)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteConfirmId(workout.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedWorkout === workout.id && workout.exercises && (
                    <CardContent className="pt-0">
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Exercícios ({workout.exercises.length})
                        </p>
                        <div className="space-y-2">
                          {workout.exercises
                            .sort((a, b) => a.order_index - b.order_index)
                            .map((ex, i) => (
                              <div key={ex.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                  {i + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ex.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {ex.sets}x{ex.reps}{ex.weight ? ` • ${ex.weight}kg` : ''} • Descanso: {ex.rest_seconds}s
                                  </p>
                                </div>
                                {ex.muscle_group && (
                                  <Badge variant="secondary">{MUSCLE_GROUP_LABELS[ex.muscle_group as MuscleGroup] ?? ex.muscle_group}</Badge>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    </CardContent>
                  )}

                  <CardContent className="pt-0 pb-4">
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2" size="sm"
                        onClick={() => startExecution(workout)}
                      >
                        <Play className="w-4 h-4" /> Iniciar Treino
                      </Button>
                      <Button
                        variant="outline" size="sm" className="gap-1"
                        onClick={() => setShowLogWorkout(workout.id)}
                      >
                        <Flag className="w-4 h-4" /> Registrar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Histórico */}
        {activeTab === 'historico' && (
          <div className="space-y-3">
            {workoutLogs.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Nenhum treino registrado ainda</p>
                </CardContent>
              </Card>
            ) : (
              workoutLogs.map(log => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {log.completed
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          : <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                        }
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{log.workout_name}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>{formatDate(log.date)}</span>
                            {log.duration_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {log.duration_minutes}min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={log.completed ? 'default' : 'secondary'}>
                        {log.completed ? 'Completo' : 'Incompleto'}
                      </Badge>
                    </div>
                    {log.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-8">{log.notes}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Exercise form helper (shared between create/edit) */}
      {/* New Workout Dialog */}
      <Dialog open={showNewWorkout} onOpenChange={setShowNewWorkout}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Treino</DialogTitle>
          </DialogHeader>
          <WorkoutForm
            form={newWorkout}
            setForm={setNewWorkout as any}
            exercises={exercises}
            setExercises={setExercises}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewWorkout(false)}>Cancelar</Button>
            <Button onClick={createWorkout} disabled={!newWorkout.name || isMutating}>
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Treino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Workout Dialog */}
      <Dialog open={!!editingWorkout} onOpenChange={open => { if (!open) setEditingWorkout(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Treino</DialogTitle>
          </DialogHeader>
          <WorkoutForm
            form={editForm}
            setForm={setEditForm as any}
            exercises={editExercises}
            setExercises={setEditExercises}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWorkout(null)}>Cancelar</Button>
            <Button onClick={updateWorkout} disabled={!editForm.name || isMutating}>
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Workout Dialog (quick log without execution) */}
      <Dialog open={!!showLogWorkout} onOpenChange={() => setShowLogWorkout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Treino</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Duração (minutos)</label>
              <Input type="number" placeholder="60" value={logData.duration_minutes} onChange={e => setLogData(p => ({ ...p, duration_minutes: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Observações</label>
              <Textarea placeholder="Como foi o treino?" value={logData.notes} onChange={e => setLogData(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogWorkout(null)}>Cancelar</Button>
            <Button
              disabled={isMutating}
              onClick={() => {
                const workout = workouts.find(w => w.id === showLogWorkout)
                if (workout) logWorkout(workout.id, workout.name)
              }}
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Treino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tem certeza que deseja excluir este treino? Todos os exercícios serão removidos. O histórico de execuções será mantido.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={isMutating}
              onClick={() => deleteConfirmId && deleteWorkout(deleteConfirmId)}
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workout Execution Dialog */}
      <Dialog open={!!execution} onOpenChange={open => { if (!open) finishExecution(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-500" />
                {execution?.workout.name}
              </DialogTitle>
              <div className="flex items-center gap-1.5 text-sm font-mono text-gray-500 dark:text-gray-400">
                <Timer className="w-4 h-4" />
                {elapsedFormatted}
              </div>
            </div>
          </DialogHeader>

          {currentExercise && execution && (
            <div className="space-y-5">
              {/* Exercise progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Exercício {execIdx + 1} de {execution.exercises.length}</span>
                  <span>{Math.round(((execIdx) / execution.exercises.length) * 100)}% concluído</span>
                </div>
                <Progress value={(execIdx / execution.exercises.length) * 100} className="h-1.5" indicatorClassName="bg-emerald-500" />
              </div>

              {/* Current exercise */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {execIdx + 1}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{currentExercise.name}</h3>
                  {currentExercise.muscle_group && (
                    <Badge variant="secondary" className="text-xs">{MUSCLE_GROUP_LABELS[currentExercise.muscle_group as MuscleGroup] ?? currentExercise.muscle_group}</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 pl-9">
                  {currentExercise.sets} séries × {currentExercise.reps} reps
                  {currentExercise.weight ? ` · ${currentExercise.weight}kg` : ''}
                  {' · '}{currentExercise.rest_seconds}s descanso
                </p>
              </div>

              {/* Sets tracker */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Séries</p>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: currentExercise.sets }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                        i < setsCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : i === setsCompleted
                          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {i < setsCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rest timer */}
              {restTimer !== null && restTimer > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Pause className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Descanso</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{restTimer}s</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setRestTimer(null)}>
                    Pular
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  className="w-full gap-2"
                  disabled={restTimer !== null && restTimer > 0}
                  onClick={nextSet}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {setsCompleted + 1 < currentExercise.sets
                    ? `Completar Série ${setsCompleted + 1}/${currentExercise.sets}`
                    : execIdx + 1 < execution.exercises.length
                    ? 'Concluir Exercício → Próximo'
                    : 'Concluir Último Exercício'}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={skipExercise}>
                    <SkipForward className="w-4 h-4" /> Pular Exercício
                  </Button>
                  <Button
                    variant="outline" size="sm" className="flex-1 gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    disabled={isMutating}
                    onClick={() => finishExecution(true)}
                  >
                    {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Flag className="w-4 h-4" /> Finalizar</>}
                  </Button>
                </div>
              </div>

              {/* Upcoming exercises */}
              {execIdx + 1 < execution.exercises.length && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                  <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">Próximo:</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold">
                      {execIdx + 2}
                    </div>
                    {execution.exercises[execIdx + 1].name}
                    <span className="text-xs">
                      — {execution.exercises[execIdx + 1].sets}×{execution.exercises[execIdx + 1].reps}
                      {execution.exercises[execIdx + 1].weight ? ` @ ${execution.exercises[execIdx + 1].weight}kg` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Shared form for create/edit workout
function WorkoutForm({
  form,
  setForm,
  exercises,
  setExercises,
}: {
  form: typeof WORKOUT_FORM_DEFAULTS
  setForm: React.Dispatch<React.SetStateAction<typeof WORKOUT_FORM_DEFAULTS>>
  exercises: Partial<Exercise>[]
  setExercises: React.Dispatch<React.SetStateAction<Partial<Exercise>[]>>
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Nome do Treino *</label>
          <Input placeholder="Ex: Treino A - Peito e Tríceps" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Tipo</label>
          <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['A','B','C','D','E'].map(t => <SelectItem key={t} value={t}>Treino {t}</SelectItem>)}
              <SelectItem value="fullbody">Full Body</SelectItem>
              <SelectItem value="hiit">HIIT</SelectItem>
              <SelectItem value="cardio">Cardio</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Duração estimada (min)</label>
          <Input type="number" placeholder="60" value={form.estimated_duration} onChange={e => setForm(p => ({ ...p, estimated_duration: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Descrição</label>
          <Textarea placeholder="Descrição opcional..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Exercícios</label>
          <Button size="sm" variant="outline" onClick={() => setExercises(prev => [...prev, { ...EXERCISE_DEFAULTS(), order_index: prev.length }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-3">
          {exercises.map((ex, i) => (
            <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Exercício {i + 1}</span>
                {exercises.length > 1 && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setExercises(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Input placeholder="Nome do exercício *" value={ex.name ?? ''} onChange={e => setExercises(prev => prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))} />
                </div>
                <Select value={ex.muscle_group ?? ''} onValueChange={v => setExercises(prev => prev.map((item, idx) => idx === i ? { ...item, muscle_group: v } : item))}>
                  <SelectTrigger><SelectValue placeholder="Grupo muscular" /></SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map(mg => <SelectItem key={mg} value={mg}>{MUSCLE_GROUP_LABELS[mg]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Séries" value={ex.sets ?? ''} onChange={e => setExercises(prev => prev.map((item, idx) => idx === i ? { ...item, sets: parseInt(e.target.value) } : item))} />
                <Input placeholder="Reps (ex: 8-12)" value={ex.reps ?? ''} onChange={e => setExercises(prev => prev.map((item, idx) => idx === i ? { ...item, reps: e.target.value } : item))} />
                <Input type="number" placeholder="Carga (kg)" value={ex.weight ?? ''} onChange={e => setExercises(prev => prev.map((item, idx) => idx === i ? { ...item, weight: parseFloat(e.target.value) } : item))} />
                <Input type="number" placeholder="Descanso (s)" value={ex.rest_seconds ?? ''} onChange={e => setExercises(prev => prev.map((item, idx) => idx === i ? { ...item, rest_seconds: parseInt(e.target.value) } : item))} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
