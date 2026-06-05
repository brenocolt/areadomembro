import { supabase } from "@/lib/supabase"

// ============================================================ TIPOS
export type Category = { id: string; name: string; color: string; position: number }
export type SubTask = { id: string; title: string; done: boolean }
export type Task = {
    id: string
    title: string
    notes: string
    category: string
    priority: "alta" | "media" | "baixa"
    urgent: boolean
    important: boolean
    status: "todo" | "doing" | "done"
    due: string | null
    estimate: number
    subtasks: SubTask[]
}

// ============================================================ CATEGORIAS (padrão para fallback)
export const DEFAULT_CATEGORIES: Category[] = [
    { id: "pessoal", name: "Pessoal", color: "#4ba3c7", position: 0 },
    { id: "produtiva", name: "Produtiva", color: "#10b981", position: 1 },
]
export const FALLBACK_CAT: Category = { id: "pessoal", name: "Pessoal", color: "#64748b", position: 0 }

export const PRESET_COLORS = [
    "#4ba3c7", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6",
    "#ec4899", "#00b4d8", "#64748b", "#f97316", "#06b6d4",
]

// lookup com lista dinâmica
export const catByIdDyn = (cats: Category[], id: string) =>
    cats.find(c => c.id === id) || cats[0] || FALLBACK_CAT

// ============================================================ CATEGORIAS — Supabase CRUD
// ISOLAMENTO: toda leitura/escrita é estritamente filtrada por colaborador_id.
// As categorias têm id UUID único POR colaborador (não compartilham ids fixos),
// de modo que nenhum colaborador consegue ler ou sobrescrever as de outro.
export async function fetchCategories(colaboradorId: string): Promise<Category[]> {
    if (!colaboradorId) return []
    const { data, error } = await supabase
        .from("prioridades_categorias")
        .select("id, name, color, position")
        .eq("colaborador_id", colaboradorId)
        .order("position", { ascending: true })
    if (error) { console.error("fetchCategories", error); return [] }
    if (!data || data.length === 0) return []
    return data as Category[]
}

export async function seedDefaultCategories(colaboradorId: string): Promise<Category[]> {
    if (!colaboradorId) return DEFAULT_CATEGORIES
    // Gera ids UUID NOVOS por colaborador — o id da coluna é uuid, então os
    // slugs "pessoal"/"produtiva" não podem ser usados como id (e usar id fixo
    // criaria colisão entre colaboradores). Cada colaborador recebe os próprios.
    const rows = DEFAULT_CATEGORIES.map(c => ({
        id: uid(),
        colaborador_id: colaboradorId,
        name: c.name,
        color: c.color,
        position: c.position,
    }))
    const { data, error } = await supabase
        .from("prioridades_categorias")
        .insert(rows)
        .select("id, name, color, position")
    if (error) { console.error("seedDefaultCategories", error); return DEFAULT_CATEGORIES }
    return (data as Category[]) || DEFAULT_CATEGORIES
}

export async function saveCategory(cat: Category, colaboradorId: string): Promise<Category | null> {
    if (!colaboradorId) return null
    const { data, error } = await supabase
        .from("prioridades_categorias")
        .upsert({ id: cat.id, colaborador_id: colaboradorId, name: cat.name, color: cat.color, position: cat.position }, { onConflict: "id" })
        .select("id, name, color, position")
        .single()
    if (error) { console.error("saveCategory", error); return null }
    return data as Category
}

// Remoção sempre amarrada ao colaborador dono — nunca apaga a de outro.
export async function deleteCategory(id: string, colaboradorId: string) {
    if (!colaboradorId) return
    const { error } = await supabase
        .from("prioridades_categorias")
        .delete()
        .eq("id", id)
        .eq("colaborador_id", colaboradorId)
    if (error) console.error("deleteCategory", error)
}

export const PRIORITIES = [
    { id: "alta", name: "Alta" },
    { id: "media", name: "Média" },
    { id: "baixa", name: "Baixa" },
]
export const STATUSES = [
    { id: "todo", name: "A fazer", color: "#94a3b8" },
    { id: "doing", name: "Fazendo", color: "#4ba3c7" },
    { id: "done", name: "Feito", color: "#10b981" },
]

// ============================================================ DATAS
function startOfDay(d: Date | string) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export function iso(d: Date) {
    const x = startOfDay(d)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}
export function todayKey() { return iso(new Date()) }
export function offsetISO(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return iso(d) }
export function parseISO(s: string | null) { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) }
export function daysUntil(s: string | null) {
    if (!s) return null
    const ms = +startOfDay(parseISO(s)!) - +startOfDay(new Date())
    return Math.round(ms / 86400000)
}
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
export function dueLabel(s: string | null) {
    const n = daysUntil(s)
    if (n === null) return ""
    if (n === 0) return "Hoje"
    if (n === 1) return "Amanhã"
    if (n === -1) return "Ontem"
    if (n < 0) return `${Math.abs(n)} dias atrás`
    if (n < 7) return `Em ${n} dias`
    const d = parseISO(s)!
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export function dueState(s: string | null, done: boolean) {
    if (done || !s) return "normal"
    const n = daysUntil(s)!
    if (n < 0) return "overdue"
    if (n === 0) return "today"
    return "normal"
}
export function fmtEstimate(min: number) {
    if (!min) return ""
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60), m = min % 60
    return m ? `${h}h${m}` : `${h}h`
}

// ============================================================ EISENHOWER
export function quadrant(t: Task) {
    if (t.urgent && t.important) return "q1"
    if (!t.urgent && t.important) return "q2"
    if (t.urgent && !t.important) return "q3"
    return "q4"
}
export const QUADRANTS = [
    { id: "q1", n: "Faça primeiro", d: "Urgente + Importante", icon: "flame", urgent: true, important: true },
    { id: "q2", n: "Agende", d: "Importante, sem pressa", icon: "star", urgent: false, important: true },
    { id: "q3", n: "Delegue", d: "Urgente, pouco importante", icon: "arrowRight", urgent: true, important: false },
    { id: "q4", n: "Quando der", d: "Nem urgente nem importante", icon: "layers", urgent: false, important: false },
]

// ============================================================ SCORE (lista)
const PRIO_W: Record<string, number> = { alta: 3, media: 2, baixa: 1 }
export function score(t: Task) {
    let s = PRIO_W[t.priority] * 100
    const n = daysUntil(t.due)
    if (n !== null) {
        if (n < 0) s += 400 + Math.min(Math.abs(n), 30) * 5
        else s += Math.max(0, 60 - n)
    }
    if (t.urgent) s += 60
    if (t.important) s += 40
    return s
}

export function subProgress(t: Task) {
    const subs = t.subtasks || []
    if (!subs.length) return null
    return { done: subs.filter(s => s.done).length, total: subs.length }
}

export function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
    return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ============================================================ SUPABASE CRUD
const COLS = "id, title, notes, category, priority, urgent, important, status, due, estimate, subtasks"

function rowToTask(r: any): Task {
    return {
        id: r.id,
        title: r.title || "",
        notes: r.notes || "",
        category: r.category || "operacoes",
        priority: r.priority || "media",
        urgent: !!r.urgent,
        important: !!r.important,
        status: r.status || "todo",
        due: r.due || null,
        estimate: r.estimate || 0,
        subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    }
}

function taskToRow(t: Task, colaboradorId: string) {
    return {
        id: t.id,
        colaborador_id: colaboradorId,
        title: t.title,
        notes: t.notes || "",
        category: t.category,
        priority: t.priority,
        urgent: t.urgent,
        important: t.important,
        status: t.status,
        due: t.due,
        estimate: t.estimate || 0,
        subtasks: t.subtasks || [],
    }
}

export async function fetchTasks(colaboradorId: string): Promise<Task[]> {
    if (!colaboradorId) return []
    const { data, error } = await supabase
        .from("prioridades_tarefas")
        .select(COLS)
        .eq("colaborador_id", colaboradorId)
        .order("created_at", { ascending: true })
    if (error) { console.error("fetchTasks", error); return [] }
    return (data || []).map(rowToTask)
}

export async function saveTask(t: Task, colaboradorId: string) {
    if (!colaboradorId) return
    const { error } = await supabase
        .from("prioridades_tarefas")
        .upsert(taskToRow(t, colaboradorId), { onConflict: "id" })
    if (error) console.error("saveTask", error)
}

// patch/delete sempre amarrados ao colaborador dono — isolamento por linha.
export async function patchTask(id: string, patch: Record<string, any>, colaboradorId: string) {
    if (!colaboradorId) return
    const { error } = await supabase
        .from("prioridades_tarefas")
        .update(patch)
        .eq("id", id)
        .eq("colaborador_id", colaboradorId)
    if (error) console.error("patchTask", error)
}

export async function deleteTask(id: string, colaboradorId: string) {
    if (!colaboradorId) return
    const { error } = await supabase
        .from("prioridades_tarefas")
        .delete()
        .eq("id", id)
        .eq("colaborador_id", colaboradorId)
    if (error) console.error("deleteTask", error)
}
