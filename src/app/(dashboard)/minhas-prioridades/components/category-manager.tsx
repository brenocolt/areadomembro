"use client"

import React from "react"
import { Icon } from "./icons"
import * as D from "./lib"
import type { Category } from "./lib"
import { useCats } from "./categories-context"

const SWATCHES = D.PRESET_COLORS

export function CategoryManager({ onClose, colaboradorId }: { onClose: () => void; colaboradorId: string }) {
    const { categories, setCategories } = useCats()
    const [editing, setEditing] = React.useState<Category | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState("")

    // estado do formulário de edição/criação
    const [form, setForm] = React.useState({ name: "", color: SWATCHES[0] })

    function startNew() {
        setEditing({ id: D.uid(), name: "", color: SWATCHES[0], position: categories.length })
        setForm({ name: "", color: SWATCHES[0] })
        setError("")
    }

    function startEdit(c: Category) {
        setEditing(c)
        setForm({ name: c.name, color: c.color })
        setError("")
    }

    function cancelEdit() { setEditing(null); setError("") }

    async function saveEdit() {
        const name = form.name.trim()
        if (!name) { setError("Digite um nome."); return }
        if (categories.some(c => c.id !== editing!.id && c.name.toLowerCase() === name.toLowerCase())) {
            setError("Já existe uma categoria com esse nome."); return
        }
        setSaving(true)
        const updated: Category = { ...editing!, name, color: form.color }
        const saved = await D.saveCategory(updated, colaboradorId)
        if (saved) {
            setCategories(prev => {
                const i = prev.findIndex(c => c.id === updated.id)
                if (i === -1) return [...prev, updated]
                const next = [...prev]; next[i] = updated; return next
            })
        }
        setSaving(false)
        setEditing(null)
    }

    async function remove(cat: Category) {
        if (!confirm(`Remover "${cat.name}"? As tarefas dessa categoria serão mantidas.`)) return
        await D.deleteCategory(cat.id, colaboradorId)
        setCategories(prev => prev.filter(c => c.id !== cat.id))
        if (editing?.id === cat.id) setEditing(null)
    }

    return (
        <div className="prio-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="prio-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <span className="icon-chip" style={{ background: "var(--chip-bg)", color: "var(--c500)" }}>
                        <Icon name="folder" size={18} />
                    </span>
                    <h2>Categorias</h2>
                    <button className="icon-btn bare" onClick={onClose}><Icon name="x" size={18} /></button>
                </div>

                <div className="modal-body">
                    {/* lista de categorias existentes */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {categories.map(c => (
                            <div key={c.id} style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 12px", borderRadius: "var(--r-xl)",
                                background: "var(--surface-soft)", border: "1px solid var(--border)"
                            }}>
                                <span style={{ width: 14, height: 14, borderRadius: 999, background: c.color, flex: "0 0 14px" }} />
                                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{c.name}</span>
                                <button onClick={() => startEdit(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4, borderRadius: 8 }}
                                    title="Editar">
                                    <Icon name="pencil" size={15} />
                                </button>
                                {categories.length > 1 && (
                                    <button onClick={() => remove(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", display: "flex", padding: 4, borderRadius: 8 }}
                                        title="Remover">
                                        <Icon name="trash" size={15} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* formulário de criação/edição */}
                    {editing ? (
                        <div style={{ border: "1px solid var(--c300)", borderRadius: "var(--r-xl)", padding: 16, display: "flex", flexDirection: "column", gap: 14, background: "var(--chip-bg)" }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--c600)" }}>
                                {categories.find(c => c.id === editing.id) ? "Editar categoria" : "Nova categoria"}
                            </p>

                            <div>
                                <label className="field-label">Nome</label>
                                <input
                                    className="input"
                                    placeholder="Ex: Trabalho, Estudos…"
                                    value={form.name}
                                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError("") }}
                                    onKeyDown={e => { if (e.key === "Enter") saveEdit() }}
                                    autoFocus
                                />
                                {error && <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--rose)" }}>{error}</p>}
                            </div>

                            <div>
                                <label className="field-label">Cor</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {SWATCHES.map(s => (
                                        <button key={s} onClick={() => setForm(f => ({ ...f, color: s }))} style={{
                                            width: 28, height: 28, borderRadius: 999, background: s, border: "none",
                                            cursor: "pointer", outline: form.color === s ? `3px solid ${s}` : "none",
                                            outlineOffset: 2, transform: form.color === s ? "scale(1.15)" : "scale(1)",
                                            transition: ".15s"
                                        }} />
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button className="btn btn-outline btn-sm" onClick={cancelEdit}>Cancelar</button>
                                <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                                    {saving ? "Salvando…" : "Salvar"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button className="btn btn-outline" onClick={startNew} style={{ width: "100%" }}>
                            <Icon name="plus" size={16} />Nova categoria
                        </button>
                    )}
                </div>

                <div className="modal-foot">
                    <div style={{ marginLeft: "auto" }}>
                        <button className="btn btn-primary" onClick={onClose}>Feito</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
