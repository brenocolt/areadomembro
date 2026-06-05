"use client"

import React from "react"
import { Icon } from "./icon"
import { TaskCard, ProgressRing, Empty } from "./primitives"
import * as D from "./lib"
import type { Task } from "./lib"
import { useCats } from "./categories-context"

// id sendo arrastado (módulo-level)
let DRAG: string | null = null

const isToday = (t: Task) => !!t.due && D.daysUntil(t.due) === 0
const isOverdue = (t: Task) => !!t.due && D.daysUntil(t.due)! < 0 && t.status !== "done"
const isUpcoming = (t: Task) => !!t.due && D.daysUntil(t.due)! > 0
const active = (t: Task) => t.status !== "done"

function greeting() {
    const h = new Date().getHours()
    if (h < 12) return "Bom dia"
    if (h < 18) return "Boa tarde"
    return "Boa noite"
}

type ViewProps = {
    tasks: Task[]
    onOpen: (t: Task) => void
    onToggle: (t: Task) => void
    setStatus: (id: string, status: Task["status"]) => void
    setQuadrant: (id: string, q: { urgent: boolean; important: boolean }) => void
    userName?: string
}

// ============================================================ PAINEL
export function Painel({ tasks, onOpen, onToggle, userName }: ViewProps) {
    const { categories, catById } = useCats()
    const todayTasks = tasks.filter(isToday)
    const todayDone = todayTasks.filter(t => t.status === "done").length
    const overdue = tasks.filter(isOverdue)
    const week = tasks.filter(t => active(t) && t.due && D.daysUntil(t.due)! > 0 && D.daysUntil(t.due)! <= 7)
    const doneToday = tasks.filter(t => t.status === "done" && isToday(t)).length

    const foco = tasks.filter(t => active(t) && (isToday(t) || isOverdue(t)))
        .sort((a, b) => D.score(b) - D.score(a)).slice(0, 6)

    const act = tasks.filter(active)
    const byCat = categories.map(c => ({ ...c, n: act.filter(t => t.category === c.id).length }))
        .filter(c => c.n > 0).sort((a, b) => b.n - a.n)
    const maxCat = Math.max(1, ...byCat.map(c => c.n))

    const upcoming = tasks.filter(t => active(t) && isUpcoming(t)).sort((a, b) => D.daysUntil(a.due)! - D.daysUntil(b.due)!).slice(0, 5)

    return (
        <div className="content-inner fade-up">
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <ProgressRing done={todayDone} total={Math.max(todayTasks.length, 0)} />
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 21, color: "var(--text-1)" }}>{greeting()}, {userName || "por aqui"} 👋</div>
                    <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 4 }}>
                        {todayTasks.length === 0 ? "Nada agendado para hoje. Aproveite para planejar." :
                            todayDone === todayTasks.length ? "Você concluiu tudo para hoje. Excelente!" :
                                `Você tem ${todayTasks.length - todayDone} de ${todayTasks.length} tarefas para hoje.`}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        {overdue.length > 0 && <span className="prio alta" style={{ fontSize: 11 }}><Icon name="alert" size={12} />{overdue.length} atrasada{overdue.length > 1 ? "s" : ""}</span>}
                        <span className="tag" style={{ background: "var(--chip-bg)", color: "var(--c600)" }}><Icon name="clock" size={11} />{week.length} esta semana</span>
                        <span className="tag" style={{ background: "var(--emerald-soft)", color: "var(--emerald)" }}><Icon name="check" size={11} stroke={3} />{doneToday} concluída{doneToday !== 1 ? "s" : ""} hoje</span>
                    </div>
                </div>
            </div>

            <div className="grid-stats">
                <Stat icon="today" iconColor="var(--c500)" lab="Para hoje" val={todayTasks.filter(active).length} sub="vencem hoje" />
                <Stat icon="alert" iconColor="var(--rose)" lab="Atrasadas" val={overdue.length} sub="precisam de atenção" />
                <Stat icon="calendar" iconColor="var(--amber)" lab="Esta semana" val={week.length} sub="próximos 7 dias" />
                <Stat icon="check" iconColor="var(--emerald)" lab="Concluídas" val={tasks.filter(t => t.status === "done").length} sub="no total" />
            </div>

            <div className="dash-grid">
                <div className="card bordered">
                    <div className="section-head">
                        <h2>Foco de hoje</h2>
                        <span className="hint">Atrasadas + hoje, por prioridade</span>
                    </div>
                    {foco.length ? (
                        <div className="stack">{foco.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggle={onToggle} />)}</div>
                    ) : <Empty icon="sparkles" title="Tudo em dia!" text="Nenhuma tarefa atrasada ou para hoje." />}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    <div className="card bordered">
                        <div className="section-head"><h2>Por categoria</h2></div>
                        {byCat.length ? (
                            <div className="distrib">
                                {byCat.map(c => (
                                    <div className="distrib-row" key={c.id}>
                                        <span className="dl"><span style={{ width: 8, height: 8, borderRadius: 9, background: c.color, display: "inline-block" }}></span>{c.name}</span>
                                        <span className="dbar"><i style={{ width: `${(c.n / maxCat) * 100}%`, background: c.color }}></i></span>
                                        <span className="dn">{c.n}</span>
                                    </div>
                                ))}
                            </div>
                        ) : <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>Sem tarefas ativas.</p>}
                    </div>

                    <div className="card bordered">
                        <div className="section-head"><h2>Em breve</h2></div>
                        {upcoming.length ? (
                            <div className="stack">{upcoming.map(t => (
                                <button key={t.id} onClick={() => onOpen(t)} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", padding: "7px 4px", cursor: "pointer", textAlign: "left", borderRadius: 10, width: "100%" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 9, background: catById(t.category).color, flex: "0 0 8px" }}></span>
                                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                                    <span className="meta">{D.dueLabel(t.due)}</span>
                                </button>
                            ))}</div>
                        ) : <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>Nada agendado.</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Stat({ icon, iconColor, lab, val, sub }: { icon: string; iconColor: string; lab: string; val: number; sub: string }) {
    return (
        <div className="card bordered stat">
            <span className="lab"><Icon name={icon} size={13} style={{ color: iconColor }} />{lab}</span>
            <span className="val">{val}</span>
            <span className="sub">{sub}</span>
        </div>
    )
}

// ============================================================ HOJE
export function Hoje({ tasks, onOpen, onToggle }: ViewProps) {
    const overdue = tasks.filter(isOverdue).sort((a, b) => D.daysUntil(a.due)! - D.daysUntil(b.due)!)
    const today = tasks.filter(t => isToday(t) && active(t))
    const soon = tasks.filter(t => active(t) && isUpcoming(t)).sort((a, b) => D.daysUntil(a.due)! - D.daysUntil(b.due)!)
    const someNum = overdue.length + today.length + soon.length

    return (
        <div className="content-inner fade-up">
            {someNum === 0 ? <div className="card bordered"><Empty icon="sparkles" title="Agenda livre" text="Você não tem tarefas com prazo pendentes. Que tal planejar a semana?" /></div> : null}
            <Group icon="alert" color="var(--rose)" bg="var(--rose-soft)" title="Atrasadas" items={overdue} onOpen={onOpen} onToggle={onToggle} />
            <Group icon="today" color="var(--c500)" bg="var(--chip-bg)" title="Para hoje" items={today} onOpen={onOpen} onToggle={onToggle} />
            <Group icon="calendar" color="var(--amber)" bg="var(--amber-soft)" title="Em breve" items={soon} onOpen={onOpen} onToggle={onToggle} />
        </div>
    )
}
function Group({ icon, color, bg, title, items, onOpen, onToggle }: { icon: string; color: string; bg: string; title: string; items: Task[]; onOpen: (t: Task) => void; onToggle: (t: Task) => void }) {
    if (!items.length) return null
    return (
        <div>
            <div className="group-head">
                <span className="gicon" style={{ background: bg, color }}><Icon name={icon} size={16} /></span>
                <h2>{title}</h2>
                <span className="gcount">{items.length}</span>
            </div>
            <div className="stack">{items.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggle={onToggle} />)}</div>
        </div>
    )
}

// ============================================================ LISTA
const SORTS = [
    { id: "smart", name: "Inteligente", icon: "sparkles", fn: (a: Task, b: Task) => D.score(b) - D.score(a) },
    { id: "due", name: "Prazo", icon: "calendar", fn: (a: Task, b: Task) => (D.daysUntil(a.due) ?? 9999) - (D.daysUntil(b.due) ?? 9999) },
    { id: "prio", name: "Prioridade", icon: "flag", fn: (a: Task, b: Task) => (({ alta: 0, media: 1, baixa: 2 } as any)[a.priority] - ({ alta: 0, media: 1, baixa: 2 } as any)[b.priority]) },
    { id: "cat", name: "Categoria", icon: "folder", fn: (a: Task, b: Task) => a.category.localeCompare(b.category) },
]
export function Lista({ tasks, onOpen, onToggle }: ViewProps) {
    const [sort, setSort] = React.useState("smart")
    const [open, setOpen] = React.useState(false)
    const [showDone, setShowDone] = React.useState(false)
    const cur = SORTS.find(s => s.id === sort)!
    const act = tasks.filter(active).sort(cur.fn)
    const done = tasks.filter(t => t.status === "done").sort((a, b) => D.score(b) - D.score(a))

    return (
        <div className="content-inner fade-up">
            <div className="filterbar" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>{act.length} tarefa{act.length !== 1 ? "s" : ""} ativa{act.length !== 1 ? "s" : ""}</span>
                <div style={{ display: "flex", gap: 10 }}>
                    <button className={`pill ${showDone ? "active" : ""}`} onClick={() => setShowDone(!showDone)}>
                        <Icon name="check" size={13} stroke={2.5} />Concluídas ({done.length})
                    </button>
                    <div className="sortmenu">
                        <button className="btn btn-outline btn-sm" onClick={() => setOpen(!open)}>
                            <Icon name="sort" size={15} />{cur.name}<Icon name="chevDown" size={14} />
                        </button>
                        {open && (
                            <div className="sortpop" onMouseLeave={() => setOpen(false)}>
                                {SORTS.map(s => (
                                    <button key={s.id} className={s.id === sort ? "sel" : ""} onClick={() => { setSort(s.id); setOpen(false) }}>
                                        <Icon name={s.icon} size={15} />{s.name}{s.id === sort && <Icon name="check" size={14} stroke={3} style={{ marginLeft: "auto" }} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {act.length ? (
                <div className="stack">{act.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggle={onToggle} />)}</div>
            ) : <div className="card bordered"><Empty title="Nenhuma tarefa ativa" text="Crie uma nova tarefa ou ajuste os filtros." /></div>}

            {showDone && done.length > 0 && (
                <div>
                    <div className="group-head"><span className="gicon" style={{ background: "var(--emerald-soft)", color: "var(--emerald)" }}><Icon name="check" size={16} stroke={2.5} /></span><h2>Concluídas</h2><span className="gcount">{done.length}</span></div>
                    <div className="stack">{done.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onToggle={onToggle} />)}</div>
                </div>
            )}
        </div>
    )
}

// ============================================================ CONCLUÍDAS
export function Concluidas({ tasks, onOpen, setStatus }: ViewProps) {
    const { catById } = useCats()
    const [sort, setSort] = React.useState<"prio" | "cat" | "due">("prio")
    const done = React.useMemo(() => {
        const arr = tasks.filter(t => t.status === "done")
        const fns: Record<string, (a: Task, b: Task) => number> = {
            prio: (a, b) => D.score(b) - D.score(a),
            cat: (a, b) => catById(a.category).name.localeCompare(catById(b.category).name),
            due: (a, b) => (D.daysUntil(a.due) ?? 9999) - (D.daysUntil(b.due) ?? 9999),
        }
        return [...arr].sort(fns[sort])
    }, [tasks, sort, catById])

    return (
        <div className="content-inner fade-up">
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <span className="icon-chip" style={{ background: "var(--emerald-soft)", color: "var(--emerald)", width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={22} stroke={2.5} />
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 20, color: "var(--text-1)" }}>
                        {done.length} atividade{done.length !== 1 ? "s" : ""} concluída{done.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 3 }}>
                        Reabra qualquer atividade para movê-la de volta para “A fazer”.
                    </div>
                </div>
                <div className="seg" style={{ flex: "0 0 auto" }}>
                    <button className={sort === "prio" ? "sel" : ""} onClick={() => setSort("prio")}>Prioridade</button>
                    <button className={sort === "cat" ? "sel" : ""} onClick={() => setSort("cat")}>Categoria</button>
                    <button className={sort === "due" ? "sel" : ""} onClick={() => setSort("due")}>Prazo</button>
                </div>
            </div>

            {done.length ? (
                <div className="stack">
                    {done.map(t => (
                        <div key={t.id} className="task is-done" onClick={() => onOpen(t)} style={{ cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span className="check done" style={{ flex: "0 0 22px", pointerEvents: "none" }}>
                                    <Icon name="check" size={13} stroke={3} />
                                </span>
                                <div className="task-body" style={{ flex: 1, minWidth: 0 }}>
                                    <div className="task-top"><div className="task-title">{t.title}</div></div>
                                    <div className="task-meta">
                                        <span className="tag" style={{ background: `color-mix(in srgb, ${catById(t.category).color} 13%, transparent)`, color: catById(t.category).color }}>
                                            <span className="dot" style={{ background: catById(t.category).color }}></span>{catById(t.category).name}
                                        </span>
                                        {t.due ? <span className="meta"><Icon name="calendar" size={13} />{D.dueLabel(t.due)}</span> : null}
                                        {t.estimate ? <span className="meta"><Icon name="clock" size={13} />{D.fmtEstimate(t.estimate)}</span> : null}
                                    </div>
                                </div>
                                <button
                                    className="btn btn-outline btn-sm"
                                    style={{ flex: "0 0 auto" }}
                                    onClick={(e) => { e.stopPropagation(); setStatus(t.id, "todo") }}
                                    title="Reabrir atividade"
                                >
                                    <Icon name="undo" size={15} />Reabrir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card bordered">
                    <Empty icon="check" title="Nada concluído ainda" text="Quando você concluir atividades, elas aparecerão aqui para consulta e reabertura." />
                </div>
            )}
        </div>
    )
}

// ============================================================ QUADRO (KANBAN)
export function Quadro({ tasks, onOpen, onToggle, setStatus }: ViewProps) {
    const [over, setOver] = React.useState<string | null>(null)
    const cols = D.STATUSES
    const handleDrop = (status: string) => {
        setOver(null)
        if (DRAG) { setStatus(DRAG, status as Task["status"]); DRAG = null }
    }
    return (
        <div className="content-inner fade-up">
            <div className="kanban">
                {cols.map(col => {
                    const items = tasks.filter(t => t.status === col.id)
                    return (
                        <div key={col.id}
                            className={`kcol ${over === col.id ? "over" : ""}`}
                            onDragOver={(e) => { e.preventDefault(); if (over !== col.id) setOver(col.id) }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) }}
                            onDrop={() => handleDrop(col.id)}
                        >
                            <div className="kcol-head">
                                <span className="kdot" style={{ background: col.color }}></span>
                                <span className="ktitle">{col.name}</span>
                                <span className="kcount">{items.length}</span>
                            </div>
                            <div className="kcards">
                                {items.map(t => (
                                    <TaskCard key={t.id} task={t} compact draggable onOpen={onOpen} onToggle={onToggle}
                                        onDragStart={(e) => { DRAG = t.id; (e.currentTarget as HTMLElement).classList.add("dragging") }}
                                        onDragEnd={(e) => { (e.currentTarget as HTMLElement).classList.remove("dragging"); setOver(null) }} />
                                ))}
                                {items.length === 0 && <div style={{ fontSize: 12, color: "var(--text-4)", textAlign: "center", padding: "14px 0" }}>Arraste tarefas para cá</div>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================================ MATRIZ (EISENHOWER)
export function Matriz({ tasks, onOpen, onToggle, setQuadrant }: ViewProps) {
    const [over, setOver] = React.useState<string | null>(null)
    const handleDrop = (q: { urgent: boolean; important: boolean }) => {
        setOver(null)
        if (DRAG) { setQuadrant(DRAG, { urgent: q.urgent, important: q.important }); DRAG = null }
    }
    return (
        <div className="content-inner fade-up">
            <div className="matrix">
                {D.QUADRANTS.map(q => {
                    const items = tasks.filter(t => active(t) && D.quadrant(t) === q.id)
                    return (
                        <div key={q.id}
                            className={`quad ${q.id} ${over === q.id ? "over" : ""}`}
                            onDragOver={(e) => { e.preventDefault(); if (over !== q.id) setOver(q.id) }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) }}
                            onDrop={() => handleDrop(q)}
                        >
                            <div className="quad-head">
                                <span className="qbadge"><Icon name={q.icon} size={18} /></span>
                                <div style={{ flex: 1 }}>
                                    <div className="qn">{q.n}</div>
                                    <div className="qd">{q.d}</div>
                                </div>
                                <span className="kcount" style={{ background: "var(--card)" }}>{items.length}</span>
                            </div>
                            <div className="quad-cards">
                                {items.map(t => (
                                    <TaskCard key={t.id} task={t} compact draggable onOpen={onOpen} onToggle={onToggle}
                                        onDragStart={(e) => { DRAG = t.id; (e.currentTarget as HTMLElement).classList.add("dragging") }}
                                        onDragEnd={(e) => { (e.currentTarget as HTMLElement).classList.remove("dragging"); setOver(null) }} />
                                ))}
                                {items.length === 0 && <div style={{ fontSize: 12, color: "var(--text-4)", textAlign: "center", padding: "10px 0" }}>—</div>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
