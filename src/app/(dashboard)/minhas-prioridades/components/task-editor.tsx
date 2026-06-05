"use client"

import React from "react"
import { Icon } from "./icon"
import * as D from "./lib"
import type { Task } from "./lib"
import { useCats } from "./categories-context"

const ESTIMATES = [
    { v: 15, l: "15min" }, { v: 30, l: "30min" }, { v: 60, l: "1h" },
    { v: 120, l: "2h" }, { v: 240, l: "4h" }, { v: 0, l: "—" },
]
const PRESET_ESTIMATES = ESTIMATES.map(e => e.v)

export function TaskEditor({ task, isNew, onSave, onDelete, onClose }: {
    task: Task; isNew: boolean; onSave: (t: Task) => void; onDelete: (id: string) => void; onClose: () => void
}) {
    const [t, setT] = React.useState<Task>(() => ({ ...task, subtasks: task.subtasks || [], notes: task.notes || "", estimate: task.estimate || 0 }))
    const { categories, catById } = useCats()
    const [titleError, setTitleError] = React.useState(false)
    // Modo personalizado de estimativa: ativo quando o valor não é um dos presets.
    const [customEstimate, setCustomEstimate] = React.useState(() => {
        const e = task.estimate || 0
        return e > 0 && !PRESET_ESTIMATES.includes(e)
    })
    const titleRef = React.useRef<HTMLTextAreaElement>(null)

    React.useEffect(() => {
        if (titleRef.current) titleRef.current.focus()
        const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", esc)
        return () => window.removeEventListener("keydown", esc)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const set = (patch: Partial<Task>) => setT(prev => ({ ...prev, ...patch }))
    const cat = catById(t.category)

    const addSub = () => set({ subtasks: [...(t.subtasks || []), { id: D.uid(), title: "", done: false }] })
    const updSub = (id: string, patch: Partial<D.SubTask>) => set({ subtasks: t.subtasks.map(s => s.id === id ? { ...s, ...patch } : s) })
    const rmSub = (id: string) => set({ subtasks: t.subtasks.filter(s => s.id !== id) })

    const save = () => {
        const title = (t.title || "").trim()
        if (!title) {
            setTitleError(true)
            titleRef.current?.focus()
            return
        }
        onSave({ ...t, title, subtasks: (t.subtasks || []).filter(s => s.title.trim()) })
    }

    const sp = D.subProgress(t)

    return (
        <div className="prio-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="prio-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <span className="icon-chip" style={{ background: `color-mix(in srgb, ${cat.color} 14%, transparent)`, color: cat.color }}>
                        <Icon name={isNew ? "plus" : "pencil"} size={18} />
                    </span>
                    <h2>{isNew ? "Nova tarefa" : "Editar tarefa"}</h2>
                    <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={18} /></button>
                </div>

                <div className="modal-body">
                    <div>
                        <label className="field-label">Título <span style={{ color: "var(--rose)" }}>*</span></label>
                        <textarea
                            ref={titleRef}
                            className="title-input"
                            rows={2}
                            placeholder="O que precisa ser feito?"
                            value={t.title || ""}
                            onChange={(e) => { set({ title: e.target.value }); if (titleError) setTitleError(false) }}
                            onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = el.scrollHeight + "px" }}
                            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save() }}
                            style={titleError ? { borderColor: "var(--rose)", boxShadow: "0 0 0 3px rgba(244,63,94,.2)" } : undefined}
                        />
                        {titleError && <p style={{ fontSize: 12, color: "var(--rose)", marginTop: 5, marginBottom: 0 }}>Digite um título para a tarefa.</p>}
                    </div>

                    <div>
                        <label className="field-label">Prioridade</label>
                        <div className="seg">
                            {D.PRIORITIES.map(p => (
                                <button key={p.id} className={t.priority === p.id ? `sel p-${p.id}` : ""} onClick={() => set({ priority: p.id as Task["priority"] })}>{p.name}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="field-label">Matriz de Eisenhower</label>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button className={`toggle-card urg ${t.urgent ? "on" : ""}`} onClick={() => set({ urgent: !t.urgent })}>
                                <span className="ti"><Icon name="flame" size={17} /></span>
                                <div><div className="tt">Urgente</div><div className="ts">Tem pressa</div></div>
                                <span className="knob"></span>
                            </button>
                            <button className={`toggle-card ${t.important ? "on" : ""}`} onClick={() => set({ important: !t.important })}>
                                <span className="ti"><Icon name="star" size={17} /></span>
                                <div><div className="tt">Importante</div><div className="ts">Gera impacto</div></div>
                                <span className="knob"></span>
                            </button>
                        </div>
                    </div>

                    <div className="field-row">
                        <div>
                            <label className="field-label">Categoria</label>
                            <div style={{ position: "relative" }}>
                                <select className="select" value={t.category} onChange={(e) => set({ category: e.target.value })} style={{ paddingLeft: 34 }}>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 9, height: 9, borderRadius: 9, background: cat.color, pointerEvents: "none" }}></span>
                                <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", pointerEvents: "none" }}><Icon name="chevDown" size={15} /></span>
                            </div>
                        </div>
                        <div>
                            <label className="field-label">Status</label>
                            <div className="seg">
                                {D.STATUSES.map(s => (
                                    <button key={s.id} className={t.status === s.id ? "sel st" : ""} onClick={() => set({ status: s.id as Task["status"] })} style={{ fontSize: 11.5, padding: "8px 4px" }}>{s.name}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="field-row">
                        <div>
                            <label className="field-label">Prazo</label>
                            <input type="date" className="input" value={t.due || ""} onChange={(e) => set({ due: e.target.value || null })} />
                        </div>
                        <div>
                            <label className="field-label">Estimativa</label>
                            <div style={{ position: "relative" }}>
                                <select
                                    className="select"
                                    value={customEstimate ? "custom" : String(t.estimate || 0)}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        if (v === "custom") {
                                            setCustomEstimate(true)
                                            if (!t.estimate || PRESET_ESTIMATES.includes(t.estimate)) set({ estimate: 300 })
                                        } else {
                                            setCustomEstimate(false)
                                            set({ estimate: Number(v) })
                                        }
                                    }}
                                >
                                    {ESTIMATES.map(e => <option key={e.v} value={e.v}>{e.l}</option>)}
                                    <option value="custom">Personalizado…</option>
                                </select>
                                <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", pointerEvents: "none" }}><Icon name="chevDown" size={15} /></span>
                            </div>
                            {customEstimate && (
                                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        className="input"
                                        style={{ width: 110 }}
                                        placeholder="Ex: 6"
                                        value={t.estimate ? Number((t.estimate / 60).toFixed(2)) : ""}
                                        onChange={(e) => {
                                            const h = parseFloat(e.target.value)
                                            set({ estimate: isNaN(h) || h < 0 ? 0 : Math.round(h * 60) })
                                        }}
                                    />
                                    <span style={{ fontSize: 13, color: "var(--text-3)" }}>horas</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="field-label">Checklist {sp ? `· ${sp.done}/${sp.total}` : ""}</label>
                        <div className="sub-list">
                            {(t.subtasks || []).map(s => (
                                <div key={s.id} className={`sub-item ${s.done ? "done" : ""}`}>
                                    <button className={`scheck ${s.done ? "done" : ""}`} onClick={() => updSub(s.id, { done: !s.done })}><Icon name="check" size={11} stroke={3} /></button>
                                    <input value={s.title} placeholder="Subtarefa…" onChange={(e) => updSub(s.id, { title: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub() } }} />
                                    <span className="srm" onClick={() => rmSub(s.id)}><Icon name="x" size={15} /></span>
                                </div>
                            ))}
                            <button className="add-sub" onClick={addSub}><Icon name="plus" size={15} />Adicionar item</button>
                        </div>
                    </div>

                    <div>
                        <label className="field-label">Notas</label>
                        <textarea className="textarea" placeholder="Detalhes, links, contexto…" value={t.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
                    </div>
                </div>

                <div className="modal-foot">
                    {!isNew && <button className="btn btn-danger btn-sm" onClick={() => onDelete(t.id)}><Icon name="trash" size={15} />Excluir</button>}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
                        <button className="btn btn-primary" onClick={save}><Icon name="check" size={16} stroke={2.5} />{isNew ? "Criar tarefa" : "Salvar"}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
