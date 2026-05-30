'use client'

import { useState, useTransition } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Profile, BodyMeasurement, PersonalRecord } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getTodayString, calculateBMI, getBMICategory, formatDate, formatDateShort } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, Legend,
} from 'recharts'
import { Plus, TrendingUp, Scale, Target, Trophy, Activity, Loader2 } from 'lucide-react'

interface ProgressoViewProps {
  userId: string
  profile: Profile | null
  measurements: BodyMeasurement[]
  personalRecords: PersonalRecord[]
}

export function ProgressoView({ userId, profile, measurements, personalRecords }: ProgressoViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMutating, setIsMutating] = useState(false)
  const [activeTab, setActiveTab] = useState<'corpo' | 'medidas' | 'records'>('corpo')
  const [showNewMeasurement, setShowNewMeasurement] = useState(false)
  const [showNewRecord, setShowNewRecord] = useState(false)

  const [measurement, setMeasurement] = useState({
    weight: '', body_fat_percentage: '', chest: '', waist: '', hips: '',
    left_arm: '', right_arm: '', left_thigh: '', right_thigh: '',
    left_calf: '', right_calf: '', notes: '', date: getTodayString(),
  })

  const [prData, setPrData] = useState({ exercise_name: '', weight: '', reps: '', notes: '', date: getTodayString() })

  const refresh = () => startTransition(() => router.refresh())

  const latestMeasurement = measurements[measurements.length - 1]
  const previousMeasurement = measurements[measurements.length - 2]

  const currentWeight = latestMeasurement?.weight ?? profile?.weight
  const bmi = currentWeight && profile?.height ? calculateBMI(currentWeight, profile.height) : null
  const weightChange = latestMeasurement?.weight && previousMeasurement?.weight
    ? latestMeasurement.weight - previousMeasurement.weight
    : null

  // Weight change color depends on goal: gaining weight is good for hypertrophy, bad for weight loss
  const goal = profile?.goal
  const weightChangePositive = weightChange !== null
    ? (goal === 'hipertrofia' ? weightChange > 0 : weightChange < 0)
    : false
  const weightChangeColor = weightChange === null
    ? ''
    : weightChangePositive
    ? 'text-emerald-500'
    : 'text-red-500'

  const weightChartData = measurements
    .filter(m => m.weight)
    .map(m => ({ date: formatDateShort(m.date), peso: m.weight, gordura: m.body_fat_percentage }))

  // Build measurement history chart data — only include measurements that have at least one body measure
  const measurementChartData = measurements
    .filter(m => m.waist || m.chest || m.left_arm || m.right_arm || m.hips)
    .map(m => ({
      date: formatDateShort(m.date),
      cintura: m.waist,
      peito: m.chest,
      quadril: m.hips,
      braço: m.left_arm ? ((m.left_arm + (m.right_arm ?? m.left_arm)) / 2) : undefined,
    }))

  async function saveMeasurement() {
    setIsMutating(true)
    const supabase = createClient()
    const data: Record<string, string | number | null> = { user_id: userId, date: measurement.date }
    if (measurement.weight) data.weight = parseFloat(measurement.weight)
    if (measurement.body_fat_percentage) data.body_fat_percentage = parseFloat(measurement.body_fat_percentage)
    if (measurement.chest) data.chest = parseFloat(measurement.chest)
    if (measurement.waist) data.waist = parseFloat(measurement.waist)
    if (measurement.hips) data.hips = parseFloat(measurement.hips)
    if (measurement.left_arm) data.left_arm = parseFloat(measurement.left_arm)
    if (measurement.right_arm) data.right_arm = parseFloat(measurement.right_arm)
    if (measurement.left_thigh) data.left_thigh = parseFloat(measurement.left_thigh)
    if (measurement.right_thigh) data.right_thigh = parseFloat(measurement.right_thigh)
    if (measurement.left_calf) data.left_calf = parseFloat(measurement.left_calf)
    if (measurement.right_calf) data.right_calf = parseFloat(measurement.right_calf)
    if (measurement.notes) data.notes = measurement.notes

    await supabase.from('body_measurements').insert(data)
    if (measurement.weight && profile) {
      await supabase.from('profiles').update({ weight: parseFloat(measurement.weight) }).eq('id', userId)
    }
    setShowNewMeasurement(false)
    setMeasurement({
      weight: '', body_fat_percentage: '', chest: '', waist: '', hips: '',
      left_arm: '', right_arm: '', left_thigh: '', right_thigh: '',
      left_calf: '', right_calf: '', notes: '', date: getTodayString(),
    })
    setIsMutating(false)
    refresh()
  }

  async function saveRecord() {
    setIsMutating(true)
    const supabase = createClient()
    await supabase.from('personal_records').insert({
      user_id: userId,
      exercise_name: prData.exercise_name,
      weight: prData.weight ? parseFloat(prData.weight) : null,
      reps: prData.reps ? parseInt(prData.reps) : null,
      notes: prData.notes || null,
      date: prData.date,
    })
    setShowNewRecord(false)
    setPrData({ exercise_name: '', weight: '', reps: '', notes: '', date: getTodayString() })
    setIsMutating(false)
    refresh()
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar title="Progresso" />

      <div className="flex-1 p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Acompanhamento Corporal</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monitore sua evolução física ao longo do tempo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewRecord(true)} className="gap-2 hidden sm:flex">
              <Trophy className="w-4 h-4" /> Novo PR
            </Button>
            <Button onClick={() => setShowNewMeasurement(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Registrar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Peso Atual</span>
                <Scale className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentWeight ? `${currentWeight}kg` : '--'}
              </p>
              {weightChange !== null && (
                <p className={`text-xs mt-1 ${weightChangeColor}`}>
                  {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)}kg desde última medição
                  {goal === 'hipertrofia' && weightChange > 0 ? ' 💪' : goal === 'emagrecimento' && weightChange < 0 ? ' 🎉' : ''}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">IMC</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {bmi ? bmi.toFixed(1) : '--'}
              </p>
              {bmi && <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">{getBMICategory(bmi)}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">% Gordura</span>
                <Target className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {latestMeasurement?.body_fat_percentage ? `${latestMeasurement.body_fat_percentage}%` : '--'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Records (PR)</span>
                <Trophy className="w-4 h-4 text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{personalRecords.length}</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">Total registrado</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {(['corpo', 'medidas', 'records'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {tab === 'corpo' ? 'Peso/Gordura' : tab === 'medidas' ? 'Medidas' : 'Records (PR)'}
            </button>
          ))}
        </div>

        {/* Peso/Gordura tab */}
        {activeTab === 'corpo' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Evolução do Peso
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weightChartData.length < 2 ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-600">
                    <div className="text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Registre pelo menos 2 pesagens para ver o gráfico</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={weightChartData}>
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="peso" name="Peso (kg)" stroke="#10b981" fill="url(#weightGradient)" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
                      {weightChartData.some(d => d.gordura) && (
                        <Line type="monotone" dataKey="gordura" name="% Gordura" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316' }} strokeDasharray="4 2" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Measurement History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Medições</CardTitle>
              </CardHeader>
              <CardContent>
                {measurements.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                    <Scale className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Nenhuma medição registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {[...measurements].reverse().map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(m.date)}</span>
                        <div className="flex gap-4 text-sm">
                          {m.weight && <span className="font-medium text-gray-900 dark:text-gray-100">{m.weight}kg</span>}
                          {m.body_fat_percentage && <span className="text-orange-500">{m.body_fat_percentage}% fat</span>}
                          {m.waist && <span className="text-blue-500">Cin: {m.waist}cm</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Medidas tab */}
        {activeTab === 'medidas' && (
          <div className="space-y-6">
            {/* Measurements evolution chart */}
            {measurementChartData.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> Evolução das Medidas (cm)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={measurementChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 3', 'dataMax + 3']} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {measurementChartData.some(d => d.cintura) && (
                        <Line type="monotone" dataKey="cintura" name="Cintura" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      )}
                      {measurementChartData.some(d => d.peito) && (
                        <Line type="monotone" dataKey="peito" name="Peito" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      )}
                      {measurementChartData.some(d => d.quadril) && (
                        <Line type="monotone" dataKey="quadril" name="Quadril" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      )}
                      {measurementChartData.some(d => d.braço) && (
                        <Line type="monotone" dataKey="braço" name="Braço (média)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Current measurements grid */}
            {latestMeasurement ? (
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Última medição: {formatDate(latestMeasurement.date)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {([
                    { label: 'Peito', value: latestMeasurement.chest },
                    { label: 'Cintura', value: latestMeasurement.waist },
                    { label: 'Quadril', value: latestMeasurement.hips },
                    { label: 'Braço Esq.', value: latestMeasurement.left_arm },
                    { label: 'Braço Dir.', value: latestMeasurement.right_arm },
                    { label: 'Coxa Esq.', value: latestMeasurement.left_thigh },
                    { label: 'Coxa Dir.', value: latestMeasurement.right_thigh },
                    { label: 'Panturrilha Esq.', value: latestMeasurement.left_calf },
                    { label: 'Panturrilha Dir.', value: latestMeasurement.right_calf },
                  ] as { label: string; value: number | null }[]).map(({ label, value }) => {
                    // Find the previous measurement's value for this field
                    const key = label === 'Peito' ? 'chest' : label === 'Cintura' ? 'waist' : label === 'Quadril' ? 'hips'
                      : label === 'Braço Esq.' ? 'left_arm' : label === 'Braço Dir.' ? 'right_arm'
                      : label === 'Coxa Esq.' ? 'left_thigh' : label === 'Coxa Dir.' ? 'right_thigh'
                      : label === 'Panturrilha Esq.' ? 'left_calf' : 'right_calf'
                    const prevValue = previousMeasurement ? (previousMeasurement as any)[key] as number | null : null
                    const diff = value && prevValue ? value - prevValue : null
                    return (
                      <Card key={label}>
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {value ? `${value}cm` : '--'}
                          </p>
                          {diff !== null && (
                            <p className={`text-xs mt-1 ${diff < 0 ? 'text-blue-500' : diff > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}cm vs anterior
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhuma medida registrada ainda</p>
                  <Button onClick={() => setShowNewMeasurement(true)}>Registrar medidas</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Records tab */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowNewRecord(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" /> Novo Record
              </Button>
            </div>
            {personalRecords.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Trophy className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Nenhum record registrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personalRecords.map(pr => (
                  <Card key={pr.id} className="border-l-4 border-l-yellow-400">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{pr.exercise_name}</h3>
                        <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      </div>
                      <div className="flex gap-4">
                        {pr.weight && <div><p className="text-xl font-bold">{pr.weight}kg</p><p className="text-xs text-gray-500">Carga</p></div>}
                        {pr.reps && <div><p className="text-xl font-bold">{pr.reps}</p><p className="text-xs text-gray-500">Reps</p></div>}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{formatDate(pr.date)}</p>
                      {pr.notes && <p className="text-xs text-gray-500 mt-1">{pr.notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Measurement Dialog */}
      <Dialog open={showNewMeasurement} onOpenChange={setShowNewMeasurement}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Medições</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Data</label>
              <Input type="date" value={measurement.date} onChange={e => setMeasurement(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Peso (kg)</label>
                <Input type="number" step="0.1" placeholder="70.5" value={measurement.weight} onChange={e => setMeasurement(p => ({ ...p, weight: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">% Gordura</label>
                <Input type="number" step="0.1" placeholder="15.0" value={measurement.body_fat_percentage} onChange={e => setMeasurement(p => ({ ...p, body_fat_percentage: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Medidas (cm)</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Peito', key: 'chest' }, { label: 'Cintura', key: 'waist' },
                { label: 'Quadril', key: 'hips' }, { label: 'Braço Esq.', key: 'left_arm' },
                { label: 'Braço Dir.', key: 'right_arm' }, { label: 'Coxa Esq.', key: 'left_thigh' },
                { label: 'Coxa Dir.', key: 'right_thigh' }, { label: 'Panturrilha Esq.', key: 'left_calf' },
                { label: 'Panturrilha Dir.', key: 'right_calf' },
              ] as { label: string; key: string }[]).map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{label}</label>
                  <Input type="number" step="0.1" placeholder="0" value={(measurement as any)[key]} onChange={e => setMeasurement(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Observações</label>
              <Textarea placeholder="Notas opcionais..." value={measurement.notes} onChange={e => setMeasurement(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMeasurement(false)}>Cancelar</Button>
            <Button onClick={saveMeasurement} disabled={isMutating}>
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Medições'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New PR Dialog */}
      <Dialog open={showNewRecord} onOpenChange={setShowNewRecord}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Personal Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Exercício *</label>
              <Input placeholder="Ex: Supino Reto" value={prData.exercise_name} onChange={e => setPrData(p => ({ ...p, exercise_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Carga máxima (kg)</label>
                <Input type="number" step="0.5" placeholder="100" value={prData.weight} onChange={e => setPrData(p => ({ ...p, weight: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Repetições</label>
                <Input type="number" placeholder="1" value={prData.reps} onChange={e => setPrData(p => ({ ...p, reps: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Data</label>
              <Input type="date" value={prData.date} onChange={e => setPrData(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Observações</label>
              <Textarea placeholder="Contexto do record..." value={prData.notes} onChange={e => setPrData(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRecord(false)}>Cancelar</Button>
            <Button onClick={saveRecord} disabled={!prData.exercise_name || isMutating}>
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
