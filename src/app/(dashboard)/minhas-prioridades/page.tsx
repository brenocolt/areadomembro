"use client"

import React from "react"
import "./prioridades.css"
import { Icon } from "./components/icon"
import { Painel, Hoje, Lista, Quadro, Matriz, Concluidas } from "./components/views"
import { TaskEditor } from "./components/task-editor"
import { CategoryManager } from "./components/category-manager"
import { celebrate } from "./components/primitives"
import { CategoriesContext } from "./components/categories-context"
import * as D from "./components/lib"
import type { Task, Category } from "./components/lib"
import { useColaborador } from "@/hooks/use-supabase"

const VIEWS = [
    { id: "painel", name: "Painel", icon: "dashboard", title: "Painel", sub: "Visão geral das suas prioridades" },
    { id: "hoje", name: "Hoje", icon: "today", title: "Hoje", sub: "Atrasadas, para hoje e em breve" },
    { id: "lista", name: "Lista", icon: "list", title: "Lista priorizada", sub: "Tudo que precisa fazer, ordenado" },
    { id: "quadro", name: "Quadro", icon: "kanban", title: "Quadro Kanban", sub: "Arraste entre A fazer · Fazendo · Feito" },
    { id: "matriz", name: "Matriz", icon: "matrix", title: "Matriz de Eisenhower", sub: "Arraste para classificar urgência e impacto" },
    { id: "concluidas", name: "Concluídas", icon: "checkCircle", title: "Atividades concluídas", sub: "Tudo que você finalizou — reabra se precisar" },
]

export default function MinhasPrioridadesPage() {
    const { colaborador, colaboradorId, loading: loadingUser } = useColaborador()
    const firstName = (colaborador?.nome || "").split(" ")[0] || ""

    // ── categorias dinâmicas ──────────────────────────────────
    const [categories, setCategories] = React.useState<Category[]>(D.DEFAULT_CATEGORIES)
    const [loadingCats, setLoadingCats] = React.useState(true)
    const [showCatManager, setShowCatManager] = React.useState(false)
    const catById = React.useCallback((id: string) =>
        categories.find(c => c.id === id) || categories[0] || D.FALLBACK_CAT, [categories])

    // ── tarefas ───────────────────────────────────────────────
    const [tasks, setTasks] = React.useState<Task[]>([])
    const [loadingTasks, setLoadingTasks] = React.useState(true)
    const [view, setView] = React.useState("painel")
    const [collapsed, setCollapsed] = React.useState(false)
    const [isMobile, setIsMobile] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const [editing, setEditing] = React.useState<{ task: Task; isNew: boolean } | null>(null)

    // Auto-colapsa no mobile
    React.useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)")
        const update = (e: MediaQueryListEvent | MediaQueryList) => {
            setIsMobile(e.matches)
            if (e.matches) setCollapsed(true)
            else setCollapsed(false)
        }
        update(mq)
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    // Carrega categorias (ou semeie os padrões)
    React.useEffect(() => {
        if (loadingUser || !colaboradorId) return
        let alive = true
        D.fetchCategories(colaboradorId).then(async cats => {
            if (!alive) return
            if (cats.length === 0) {
                const seeded = await D.seedDefaultCategories(colaboradorId)
                if (alive) setCategories(seeded)
            } else {
                setCategories(cats)
            }
            setLoadingCats(false)
        })
        return () => { alive = false }
    }, [colaboradorId, loadingUser])

    // Carrega tarefas
    React.useEffect(() => {
        if (loadingUser || !colaboradorId) { if (!loadingUser) setLoadingTasks(false); return }
        let alive = true
        D.fetchTasks(colaboradorId).then(rows => { if (alive) { setTasks(rows); setLoadingTasks(false) } })
        return () => { alive = false }
    }, [colaboradorId, loadingUser])

    // ── mutações ─────────────────────────────────────────────
    const upsert = (task: Task) => {
        setTasks(prev => {
            const i = prev.findIndex(t => t.id === task.id)
            if (i === -1) return [...prev, task]
            const next = [...prev]; next[i] = task; return next
        })
        if (colaboradorId) D.saveTask(task, colaboradorId)
    }
    const removeTask = (id: string) => { setTasks(prev => prev.filter(t => t.id !== id)); if (colaboradorId) D.deleteTask(id, colaboradorId) }
    const toggleDone = (task: Task) => {
        const status = task.status === "done" ? "todo" : "done"
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t))
        if (colaboradorId) D.patchTask(task.id, { status }, colaboradorId)
    }
    const setStatus = (id: string, status: Task["status"]) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
        if (colaboradorId) D.patchTask(id, { status }, colaboradorId)
        if (status === "done") setTimeout(() => celebrate(window.innerWidth / 2, window.innerHeight / 2.6), 30)
    }
    const setQuadrant = (id: string, { urgent, important }: { urgent: boolean; important: boolean }) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, urgent, important } : t))
        if (colaboradorId) D.patchTask(id, { urgent, important }, colaboradorId)
    }

    const openTask = (task: Task) => setEditing({ task, isNew: false })
    const newTask = () => {
        const firstCat = categories[0]?.id || "pessoal"
        setEditing({
            task: { id: D.uid(), title: "", notes: "", category: firstCat, priority: "media", urgent: false, important: false, status: "todo", due: D.todayKey(), estimate: 60, subtasks: [] },
            isNew: true,
        })
    }
    const saveTask = (task: Task) => { upsert(task); setEditing(null) }

    // ── filtros ───────────────────────────────────────────────
    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        return tasks.filter(t => {
            if (q && !(t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q))) return false
            return true
        })
    }, [tasks, search])

    const counts = React.useMemo(() => ({
        hoje: tasks.filter(t => t.status !== "done" && t.due && D.daysUntil(t.due)! <= 0).length,
        lista: tasks.filter(t => t.status !== "done").length,
    }), [tasks])

    const cur = VIEWS.find(v => v.id === view)!
    const viewProps = { tasks: filtered, onOpen: openTask, onToggle: toggleDone, setStatus, setQuadrant, userName: firstName }
    const loading = loadingUser || loadingTasks || loadingCats

    return (
        <CategoriesContext.Provider value={{ categories, setCategories, catById }}>
            <div className="prio-app h-[calc(100dvh-7rem)] md:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-9rem)]">
                {/* Backdrop mobile */}
                {isMobile && !collapsed && (
                    <div className="prio-sidebar-backdrop" onClick={() => setCollapsed(true)} />
                )}

                {/* SIDEBAR SECUNDÁRIA */}
                <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
                    <div className="feat-head">
                        <span className="fh-chip"><Icon name="tasks" size={20} /></span>
                        <div>
                            <div className="fh-t">Minhas Prioridades</div>
                            <div className="fh-s">Gestão de atividades</div>
                        </div>
                    </div>

                    <nav className="nav">
                        <div className="nav-label">Visualizações</div>
                        {VIEWS.map(v => (
                            <button key={v.id} className={`nav-item ${view === v.id ? "active" : ""}`}
                                onClick={() => { setView(v.id); if (isMobile) setCollapsed(true) }}>
                                <span className="ico"><Icon name={v.icon} size={18} /></span>
                                <span className="lbl">{v.name}</span>
                                {v.id === "hoje" && counts.hoje > 0 && <span className="count">{counts.hoje}</span>}
                                {v.id === "lista" && <span className="count">{counts.lista}</span>}
                            </button>
                        ))}
                    </nav>

                    {/* Botão gerenciar categorias no rodapé da sidebar */}
                    <div className="sidebar-foot">
                        <button className="nav-item" style={{ width: "100%" }} onClick={() => setShowCatManager(true)}>
                            <span className="ico"><Icon name="folder" size={18} /></span>
                            <span className="lbl">Categorias</span>
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <div className="main">
                    <header className="topbar">
                        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher painel">
                            <Icon name="panel" size={17} />
                        </button>
                        <div className="topbar-title">
                            <span className="icon-chip"><Icon name={cur.icon} size={22} /></span>
                            <div>
                                <h1>{cur.title}</h1>
                                <p>{cur.sub}</p>
                            </div>
                        </div>
                        <div className="topbar-actions">
                            <label className="search">
                                <Icon name="search" size={16} />
                                <input placeholder="Buscar tarefa…" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </label>
                            <button className="btn btn-primary" onClick={newTask}>
                                <Icon name="plus" size={17} stroke={2.5} />Nova tarefa
                            </button>
                        </div>
                    </header>

                    <main className="content">
                        {loading ? (
                            <div className="content-inner" style={{ alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 999, border: "3px solid var(--surface-soft-2)", borderTopColor: "var(--c500)", animation: "spin 1s linear infinite" }} />
                                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                            </div>
                        ) : (
                            <>
                                {view === "painel" && <Painel {...viewProps} />}
                                {view === "hoje" && <Hoje {...viewProps} />}
                                {view === "lista" && <Lista {...viewProps} />}
                                {view === "quadro" && <Quadro {...viewProps} />}
                                {view === "matriz" && <Matriz {...viewProps} />}
                                {view === "concluidas" && <Concluidas {...viewProps} />}
                            </>
                        )}
                    </main>
                </div>

                {editing && (
                    <TaskEditor task={editing.task} isNew={editing.isNew}
                        onSave={saveTask} onDelete={(id) => { removeTask(id); setEditing(null) }} onClose={() => setEditing(null)} />
                )}

                {showCatManager && colaboradorId && (
                    <CategoryManager onClose={() => setShowCatManager(false)} colaboradorId={colaboradorId} />
                )}
            </div>
        </CategoriesContext.Provider>
    )
}
