'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Meal, FoodItem, MealType, MEAL_TYPE_LABELS } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getTodayString } from '@/lib/utils'
import { Plus, Trash2, ChevronDown, ChevronUp, Utensils, Beef, Wheat, Zap, Flame, Search, Loader2, AlertTriangle } from 'lucide-react'

interface AlimentacaoViewProps {
  userId: string
  todayMeals: Meal[]
  recentMeals: Meal[]
  profile: { daily_calorie_goal: number; daily_protein_goal: number; daily_carb_goal: number; daily_fat_goal: number } | null
}

const MEAL_TYPES: MealType[] = ['cafe_da_manha', 'almoco', 'jantar', 'lanche', 'pre_treino', 'pos_treino']
const MEAL_ICONS: Record<MealType, string> = {
  cafe_da_manha: '☕',
  almoco: '🍽️',
  jantar: '🌙',
  lanche: '🥪',
  pre_treino: '⚡',
  pos_treino: '💪',
}

interface FoodSearchResult {
  product_name: string
  nutriments: {
    'energy-kcal_100g'?: number
    'proteins_100g'?: number
    'carbohydrates_100g'?: number
    'fat_100g'?: number
  }
}

interface Per100g {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type DeleteConfirm =
  | { type: 'meal'; id: string }
  | { type: 'food'; id: string; meal: Meal }

export function AlimentacaoView({ userId, todayMeals, recentMeals, profile }: AlimentacaoViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMutating, setIsMutating] = useState(false)
  const [activeTab, setActiveTab] = useState<'hoje' | 'historico'>('hoje')
  const [showNewMeal, setShowNewMeal] = useState(false)
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null)
  const [showAddFood, setShowAddFood] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)

  const [newMeal, setNewMeal] = useState({ name: '', meal_type: 'almoco' as MealType, notes: '' })
  const [newFood, setNewFood] = useState({ name: '', quantity: '100', unit: 'g', calories: '', protein: '', carbs: '', fat: '' })

  // Food search state
  const [foodSearch, setFoodSearch] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [per100g, setPer100g] = useState<Per100g | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const refresh = () => startTransition(() => router.refresh())

  const totalCalories = todayMeals.reduce((s, m) => s + m.total_calories, 0)
  const totalProtein = todayMeals.reduce((s, m) => s + m.total_protein, 0)
  const totalCarbs = todayMeals.reduce((s, m) => s + m.total_carbs, 0)
  const totalFat = todayMeals.reduce((s, m) => s + m.total_fat, 0)

  const calorieGoal = profile?.daily_calorie_goal ?? 2000
  const proteinGoal = profile?.daily_protein_goal ?? 150
  const carbGoal = profile?.daily_carb_goal ?? 250
  const fatGoal = profile?.daily_fat_goal ?? 65

  // Recalculate macros when quantity or per100g changes
  useEffect(() => {
    if (!per100g) return
    const qty = parseFloat(newFood.quantity)
    if (isNaN(qty) || qty <= 0) return
    const factor = qty / 100
    setNewFood(p => ({
      ...p,
      calories: (per100g.calories * factor).toFixed(1),
      protein: (per100g.protein * factor).toFixed(1),
      carbs: (per100g.carbs * factor).toFixed(1),
      fat: (per100g.fat * factor).toFixed(1),
    }))
  }, [per100g, newFood.quantity])

  async function searchFood(query: string) {
    if (query.length < 2) { setSearchResults([]); return }
    setIsSearching(true)
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&fields=product_name,nutriments&page_size=8&cc=br&lc=pt`,
        { signal: AbortSignal.timeout(5000) }
      )
      const data = await res.json()
      setSearchResults(
        (data.products ?? []).filter((p: FoodSearchResult) =>
          p.product_name && (p.nutriments?.['energy-kcal_100g'] !== undefined)
        )
      )
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  function handleFoodSearchChange(value: string) {
    setFoodSearch(value)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchFood(value), 500)
  }

  function selectFood(product: FoodSearchResult) {
    const n = product.nutriments
    const p100: Per100g = {
      calories: n['energy-kcal_100g'] ?? 0,
      protein: n['proteins_100g'] ?? 0,
      carbs: n['carbohydrates_100g'] ?? 0,
      fat: n['fat_100g'] ?? 0,
    }
    const qty = parseFloat(newFood.quantity) || 100
    const factor = qty / 100
    setPer100g(p100)
    setNewFood(p => ({
      ...p,
      name: product.product_name,
      calories: (p100.calories * factor).toFixed(1),
      protein: (p100.protein * factor).toFixed(1),
      carbs: (p100.carbs * factor).toFixed(1),
      fat: (p100.fat * factor).toFixed(1),
    }))
    setSearchResults([])
    setFoodSearch('')
  }

  function resetAddFoodDialog() {
    setNewFood({ name: '', quantity: '100', unit: 'g', calories: '', protein: '', carbs: '', fat: '' })
    setPer100g(null)
    setFoodSearch('')
    setSearchResults([])
  }

  async function createMeal() {
    setIsMutating(true)
    const supabase = createClient()
    await supabase.from('meals').insert({
      user_id: userId,
      name: newMeal.name,
      meal_type: newMeal.meal_type,
      date: getTodayString(),
      notes: newMeal.notes || null,
    })
    setShowNewMeal(false)
    setNewMeal({ name: '', meal_type: 'almoco', notes: '' })
    refresh()
    setIsMutating(false)
  }

  async function deleteMeal(id: string) {
    setIsMutating(true)
    const supabase = createClient()
    await supabase.from('meals').delete().eq('id', id)
    setDeleteConfirm(null)
    refresh()
    setIsMutating(false)
  }

  async function addFoodItem(mealId: string) {
    setIsMutating(true)
    const supabase = createClient()
    const calories = parseFloat(newFood.calories) || 0
    const protein = parseFloat(newFood.protein) || 0
    const carbs = parseFloat(newFood.carbs) || 0
    const fat = parseFloat(newFood.fat) || 0

    await supabase.from('food_items').insert({
      meal_id: mealId,
      name: newFood.name,
      quantity: parseFloat(newFood.quantity) || 100,
      unit: newFood.unit,
      calories, protein, carbs, fat,
    })

    const meal = todayMeals.find(m => m.id === mealId)
    if (meal) {
      await supabase.from('meals').update({
        total_calories: meal.total_calories + calories,
        total_protein: meal.total_protein + protein,
        total_carbs: meal.total_carbs + carbs,
        total_fat: meal.total_fat + fat,
      }).eq('id', mealId)
    }

    setShowAddFood(null)
    resetAddFoodDialog()
    refresh()
    setIsMutating(false)
  }

  async function deleteFoodItem(foodId: string, meal: Meal) {
    setIsMutating(true)
    const food = meal.food_items?.find(f => f.id === foodId)
    if (!food) { setIsMutating(false); return }
    const supabase = createClient()
    await supabase.from('food_items').delete().eq('id', foodId)
    await supabase.from('meals').update({
      total_calories: meal.total_calories - food.calories,
      total_protein: meal.total_protein - food.protein,
      total_carbs: meal.total_carbs - food.carbs,
      total_fat: meal.total_fat - food.fat,
    }).eq('id', meal.id)
    setDeleteConfirm(null)
    refresh()
    setIsMutating(false)
  }

  const groupedByDate = recentMeals.reduce((acc, meal) => {
    if (!acc[meal.date]) acc[meal.date] = []
    acc[meal.date].push(meal)
    return acc
  }, {} as Record<string, Meal[]>)

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar title="Alimentação" />

      <div className="flex-1 p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gestão Alimentar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Registre suas refeições e acompanhe macros</p>
          </div>
          <Button onClick={() => setShowNewMeal(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Refeição
          </Button>
        </div>

        {/* Daily Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumo de Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <MacroStat icon={<Flame className="w-4 h-4 text-orange-500" />} label="Calorias" value={Math.round(totalCalories)} goal={calorieGoal} unit="kcal" color="bg-orange-500" />
              <MacroStat icon={<Beef className="w-4 h-4 text-red-500" />} label="Proteínas" value={Math.round(totalProtein)} goal={proteinGoal} unit="g" color="bg-red-500" />
              <MacroStat icon={<Wheat className="w-4 h-4 text-yellow-500" />} label="Carboidratos" value={Math.round(totalCarbs)} goal={carbGoal} unit="g" color="bg-yellow-500" />
              <MacroStat icon={<Zap className="w-4 h-4 text-emerald-500" />} label="Gorduras" value={Math.round(totalFat)} goal={fatGoal} unit="g" color="bg-emerald-500" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {(['hoje', 'historico'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {tab === 'hoje' ? 'Hoje' : 'Histórico'}
            </button>
          ))}
        </div>

        {activeTab === 'hoje' && (
          <div className="space-y-4">
            {todayMeals.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Utensils className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhuma refeição registrada hoje</p>
                  <Button onClick={() => setShowNewMeal(true)}>Adicionar refeição</Button>
                </CardContent>
              </Card>
            ) : (
              todayMeals.map(meal => (
                <Card key={meal.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{MEAL_ICONS[meal.meal_type]}</span>
                        <div>
                          <CardTitle className="text-base">{meal.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">{MEAL_TYPE_LABELS[meal.meal_type]}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-orange-500">{Math.round(meal.total_calories)} kcal</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}>
                          {expandedMeal === meal.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteConfirm({ type: 'meal', id: meal.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 pl-10">
                      <span>P: {Math.round(meal.total_protein)}g</span>
                      <span>C: {Math.round(meal.total_carbs)}g</span>
                      <span>G: {Math.round(meal.total_fat)}g</span>
                    </div>
                  </CardHeader>

                  {expandedMeal === meal.id && (
                    <CardContent className="pt-0">
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                        {meal.food_items && meal.food_items.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {meal.food_items.map(food => (
                              <div key={food.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{food.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {food.quantity}{food.unit} • {Math.round(food.calories)}kcal • P:{Math.round(food.protein)}g C:{Math.round(food.carbs)}g G:{Math.round(food.fat)}g
                                  </p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => setDeleteConfirm({ type: 'food', id: food.id, meal })}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="w-full gap-1"
                          onClick={() => { setShowAddFood(meal.id); resetAddFoodDialog() }}>
                          <Plus className="w-3.5 h-3.5" /> Adicionar Alimento
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="space-y-6">
            {Object.entries(groupedByDate).slice(0, 14).map(([date, meals]) => {
              const dayTotal = meals.reduce((s, m) => s + m.total_calories, 0)
              const mealDate = new Date(date + 'T12:00:00')
              const isToday = date === getTodayString()
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {isToday ? 'Hoje' : mealDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <span className="text-sm text-orange-500 font-medium">{Math.round(dayTotal)} kcal</span>
                  </div>
                  <div className="space-y-2">
                    {meals.map(meal => (
                      <div key={meal.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                        <span className="text-xl">{MEAL_ICONS[meal.meal_type]}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{meal.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{MEAL_TYPE_LABELS[meal.meal_type]}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-orange-500">{Math.round(meal.total_calories)} kcal</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">P:{Math.round(meal.total_protein)}g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Meal Dialog */}
      <Dialog open={showNewMeal} onOpenChange={setShowNewMeal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Refeição</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Nome da Refeição *</label>
              <Input placeholder="Ex: Café da manhã saudável" value={newMeal.name} onChange={e => setNewMeal(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Tipo de Refeição</label>
              <Select value={newMeal.meal_type} onValueChange={v => setNewMeal(p => ({ ...p, meal_type: v as MealType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{MEAL_ICONS[t]} {MEAL_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Observações</label>
              <Textarea placeholder="Notas opcionais..." value={newMeal.notes} onChange={e => setNewMeal(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMeal(false)}>Cancelar</Button>
            <Button onClick={createMeal} disabled={!newMeal.name || isMutating}>
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Refeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Food Dialog */}
      <Dialog open={!!showAddFood} onOpenChange={open => { if (!open) { setShowAddFood(null); resetAddFoodDialog() } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Alimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Food Search */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Buscar alimento
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Digite para buscar (ex: frango, arroz...)"
                  value={foodSearch}
                  onChange={e => handleFoodSearchChange(e.target.value)}
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {searchResults.map((product, i) => (
                    <button
                      key={i}
                      onClick={() => selectFood(product)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.product_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(product.nutriments['energy-kcal_100g'] ?? 0)} kcal · P:{Math.round(product.nutriments['proteins_100g'] ?? 0)}g · C:{Math.round(product.nutriments['carbohydrates_100g'] ?? 0)}g · G:{Math.round(product.nutriments['fat_100g'] ?? 0)}g · (por 100g)
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                Fonte: Open Food Facts. Ou preencha manualmente abaixo.
              </p>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Nome do Alimento *</label>
                <Input placeholder="Ex: Frango grelhado" value={newFood.name} onChange={e => setNewFood(p => ({ ...p, name: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Quantidade</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={newFood.quantity}
                  onChange={e => setNewFood(p => ({ ...p, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Unidade</label>
                <Select value={newFood.unit} onValueChange={v => setNewFood(p => ({ ...p, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['g', 'ml', 'unidade', 'porção', 'xícara', 'colher'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {per100g && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">
                Valores calculados automaticamente para {newFood.quantity}{newFood.unit}. Ajuste se necessário.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Calorias (kcal)</label>
                <Input type="number" placeholder="0" value={newFood.calories} onChange={e => { setPer100g(null); setNewFood(p => ({ ...p, calories: e.target.value })) }} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Proteínas (g)</label>
                <Input type="number" placeholder="0" value={newFood.protein} onChange={e => { setPer100g(null); setNewFood(p => ({ ...p, protein: e.target.value })) }} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Carboidratos (g)</label>
                <Input type="number" placeholder="0" value={newFood.carbs} onChange={e => { setPer100g(null); setNewFood(p => ({ ...p, carbs: e.target.value })) }} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Gorduras (g)</label>
                <Input type="number" placeholder="0" value={newFood.fat} onChange={e => { setPer100g(null); setNewFood(p => ({ ...p, fat: e.target.value })) }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddFood(null); resetAddFoodDialog() }}>Cancelar</Button>
            <Button onClick={() => showAddFood && addFoodItem(showAddFood)} disabled={!newFood.name || isMutating}>
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {deleteConfirm?.type === 'meal'
              ? 'Tem certeza que deseja excluir esta refeição e todos os alimentos registrados?'
              : 'Tem certeza que deseja remover este alimento da refeição?'
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={isMutating}
              onClick={() => {
                if (!deleteConfirm) return
                if (deleteConfirm.type === 'meal') deleteMeal(deleteConfirm.id)
                else deleteFoodItem(deleteConfirm.id, deleteConfirm.meal)
              }}
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MacroStat({ icon, label, value, goal, unit, color }: {
  icon: React.ReactNode; label: string; value: number; goal: number; unit: string; color: string
}) {
  const progress = Math.min((value / goal) * 100, 100)
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-end gap-1 mb-1.5">
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400 pb-0.5">/{goal}{unit}</span>
      </div>
      <Progress value={progress} className="h-1.5" indicatorClassName={color} />
    </div>
  )
}
