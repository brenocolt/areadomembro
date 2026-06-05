"use client"

import React from "react"
import { Icon } from "./icons"
import { dueLabel, dueState, fmtEstimate, subProgress, type Task } from "./lib"
import { useCats } from "./categories-context"

// ---------------- confetti ----------------
export function celebrate(x: number, y: number) {
    let layer = document.getElementById("prio-confetti-layer")
    if (!layer) {
        layer = document.createElement("div")
        layer.id = "prio-confetti-layer"
        document.body.appendChild(layer)
    }
    const colors = ["#4ba3c7", "#00D1FF", "#10b981", "#f59e0b", "#74b9d4", "#f43f5e"]
    const N = 22
    for (let i = 0; i < N; i++) {
        const el = document.createElement("div")
        el.className = "confetti"
        el.style.background = colors[i % colors.length]
        if (i % 3 === 0) el.style.borderRadius = "999px"
        el.style.left = x + "px"
        el.style.top = y + "px"
        const angle = (Math.PI * 2 * i) / N + Math.random() * 0.5
        const dist = 70 + Math.random() * 90
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist - 40
        const rot = (Math.random() * 720 - 360) + "deg"
        el.animate([
            { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) rotate(${rot}) scale(.4)`, opacity: 0 },
        ], { duration: 700 + Math.random() * 400, easing: "cubic-bezier(.2,.7,.3,1)" })
        layer.appendChild(el)
        setTimeout(() => el.remove(), 1200)
    }
}
function celebrateFromEl(el: HTMLElement | null) {
    if (!el) return
    const r = el.getBoundingClientRect()
    celebrate(r.left + r.width / 2, r.top + r.height / 2)
}

// ---------------- anel de progresso ----------------
export function ProgressRing({ done, total, size = 96, stroke = 9 }: { done: number; total: number; size?: number; stroke?: number }) {
    const pct = total ? done / total : 0
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const color = pct >= 1 ? "var(--emerald)" : "var(--c500)"
    return (
        <div className="progress-ring" style={{ width: size, height: size, flex: `0 0 ${size}px` }}>
            <svg width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-soft-2)" strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
                    style={{ transition: "stroke-dashoffset .6s cubic-bezier(.34,1.2,.5,1)" }} />
            </svg>
            <div className="ring-num">
                <b>{Math.round(pct * 100)}%</b>
                <span>{done}/{total}</span>
            </div>
        </div>
    )
}

// ---------------- chips ----------------
export function CatTag({ id }: { id: string }) {
    const { catById } = useCats()
    const c = catById(id)
    return (
        <span className="tag" style={{ background: `color-mix(in srgb, ${c.color} 13%, transparent)`, color: c.color }}>
            <span className="dot" style={{ background: c.color }}></span>{c.name}
        </span>
    )
}
function PrioBadge({ p }: { p: string }) {
    const labels: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" }
    return <span className={`prio ${p}`}><Icon name="flag" size={10} stroke={2.5} />{labels[p]}</span>
}
function DueMeta({ due, done }: { due: string | null; done: boolean }) {
    if (!due) return null
    const st = dueState(due, done)
    return (
        <span className={`meta ${st}`}>
            {st === "overdue" ? <Icon name="alert" size={13} /> : <Icon name="calendar" size={13} />}
            {dueLabel(due)}
        </span>
    )
}

// ---------------- checkbox ----------------
function Check({ done, onToggle, size }: { done: boolean; onToggle: () => void; size?: number }) {
    const ref = React.useRef<HTMLButtonElement>(null)
    return (
        <button ref={ref} className={`check ${done ? "done" : ""}`} style={size ? { width: size, height: size, flex: `0 0 ${size}px` } : undefined}
            onClick={(e) => { e.stopPropagation(); if (!done) celebrateFromEl(ref.current); onToggle() }}
            aria-label="Concluir">
            <Icon name="check" size={13} stroke={3} />
        </button>
    )
}

// ---------------- TaskCard ----------------
export function TaskCard({ task, onOpen, onToggle, onDragStart, onDragEnd, compact, draggable }: {
    task: Task
    onOpen: (t: Task) => void
    onToggle: (t: Task) => void
    onDragStart?: (e: React.DragEvent) => void
    onDragEnd?: (e: React.DragEvent) => void
    compact?: boolean
    draggable?: boolean
}) {
    const done = task.status === "done"
    const sp = subProgress(task)
    return (
        <div
            className={`task ${compact ? "compact" : ""} ${done ? "is-done" : ""}`}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onOpen(task)}
        >
            <div className={compact ? "task-row1" : ""} style={compact ? undefined : { display: "contents" }}>
                <Check done={done} onToggle={() => onToggle(task)} />
                <div className="task-body">
                    <div className="task-top">
                        <div className="task-title">{task.title}</div>
                    </div>
                    {task.notes && !compact ? <div className="task-note-1">{task.notes}</div> : null}
                    <div className="task-meta">
                        <CatTag id={task.category} />
                        <PrioBadge p={task.priority} />
                        <DueMeta due={task.due} done={done} />
                        {task.estimate ? <span className="meta"><Icon name="clock" size={13} />{fmtEstimate(task.estimate)}</span> : null}
                        {sp ? (
                            <span className="subprog">
                                <span className="subbar"><i style={{ width: `${(sp.done / sp.total) * 100}%` }}></i></span>
                                {sp.done}/{sp.total}
                            </span>
                        ) : null}
                    </div>
                </div>
                {draggable ? <span className="task-grip" onClick={(e) => e.stopPropagation()}><Icon name="grip" size={16} /></span> : null}
            </div>
        </div>
    )
}

export function Empty({ icon = "inbox", title, text }: { icon?: string; title: string; text?: string }) {
    return (
        <div className="empty">
            <div className="ecircle"><Icon name={icon} size={26} /></div>
            <h3>{title}</h3>
            {text ? <p>{text}</p> : null}
        </div>
    )
}
