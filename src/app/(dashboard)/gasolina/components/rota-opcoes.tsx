"use client"

import { formatarNumero, type RotaViagem } from "@/lib/gasolina"

type Opcao = NonNullable<RotaViagem["opcoes"]>[number]

// Polyline codificada do Google -> lista de [lat, lng].
function decodificar(codigo: string): [number, number][] {
    const pontos: [number, number][] = []
    let i = 0, lat = 0, lng = 0
    while (i < codigo.length) {
        for (const eixo of [0, 1]) {
            let resultado = 0, deslocamento = 0, b: number
            do {
                b = codigo.charCodeAt(i++) - 63
                resultado |= (b & 0x1f) << deslocamento
                deslocamento += 5
            } while (b >= 0x20 && i < codigo.length)
            const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1
            if (eixo === 0) lat += delta; else lng += delta
        }
        pontos.push([lat / 1e5, lng / 1e5])
    }
    return pontos
}

const L = 320, A = 160, MARGEM = 12

// Desenho simples dos trajetos (sem mapa de fundo): a opção escolhida em
// destaque, as outras em cinza.
function Desenho({ opcoes, escolhida }: { opcoes: Opcao[], escolhida: number }) {
    const linhas = opcoes.map(o => (o.polyline ? decodificar(o.polyline) : []))
    const todos = linhas.flat()
    if (todos.length < 2) return null

    const lats = todos.map(p => p[0]), lngs = todos.map(p => p[1])
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)   // corrige o "achatamento" da longitude
    const larg = Math.max((maxLng - minLng) * kx, 1e-6), alt = Math.max(maxLat - minLat, 1e-6)
    const escala = Math.min((L - 2 * MARGEM) / larg, (A - 2 * MARGEM) / alt)
    const offX = (L - larg * escala) / 2, offY = (A - alt * escala) / 2
    const xy = ([la, ln]: [number, number]) => [offX + (ln - minLng) * kx * escala, offY + (maxLat - la) * escala]
    const caminho = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${xy(p).map(n => n.toFixed(1)).join(",")}`).join("")

    const ordem = linhas.map((_, i) => i).sort((a, b) => (a === escolhida ? 1 : b === escolhida ? -1 : 0))
    const principal = linhas[escolhida]?.length ? linhas[escolhida] : linhas.find(l => l.length) ?? []
    const [ini, fim] = [xy(principal[0]), xy(principal[principal.length - 1])]

    return (
        <svg viewBox={`0 0 ${L} ${A}`} className="w-full max-w-full h-auto rounded-md bg-slate-50 dark:bg-slate-800/60" role="img" aria-label="Desenho das rotas">
            {ordem.map(i => linhas[i].length > 1 && (
                <path key={i} d={caminho(linhas[i])} fill="none" strokeLinecap="round" strokeLinejoin="round"
                    className={i === escolhida ? "stroke-amber-500" : "stroke-slate-300 dark:stroke-slate-600"}
                    strokeWidth={i === escolhida ? 4 : 3} />
            ))}
            <circle cx={ini[0]} cy={ini[1]} r={5} className="fill-emerald-600 stroke-white dark:stroke-slate-900" strokeWidth={2} />
            <circle cx={fim[0]} cy={fim[1]} r={5} className="fill-red-600 stroke-white dark:stroke-slate-900" strokeWidth={2} />
        </svg>
    )
}

export function RotaOpcoes({ rota, onEscolher }: { rota: RotaViagem, onEscolher: (indice: number) => void }) {
    const opcoes = rota.opcoes ?? [{ distancia_km: rota.distancia_km, duracao_min: rota.duracao_min, descricao: "" }]
    const escolhida = rota.escolhida ?? 0
    const melhor = Math.min(...opcoes.map(o => o.distancia_km))

    return (
        <div className="space-y-2">
            <Desenho opcoes={opcoes} escolhida={escolhida} />
            <div role="radiogroup" aria-label="Rota feita" className="grid gap-2">
                {opcoes.map((o, i) => (
                    <button key={i} type="button" role="radio" aria-checked={i === escolhida} onClick={() => onEscolher(i)}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${i === escolhida
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
                            : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"}`}>
                        <span className="flex items-center gap-2 min-w-0">
                            <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${i === escolhida ? "border-amber-500 bg-amber-500" : "border-slate-300 dark:border-slate-500"}`} />
                            <span className="min-w-0">
                                <span className="block truncate font-medium">{o.descricao ? `Via ${o.descricao}` : `Rota ${i + 1}`}</span>
                                <span className="block text-xs text-slate-500">
                                    {o.duracao_min > 0 ? `cerca de ${o.duracao_min} min` : ""}
                                    {o.distancia_km === melhor && opcoes.length > 1 ? " · melhor caminho (menor distância)" : ""}
                                </span>
                            </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatarNumero(o.distancia_km, 1)} km</span>
                    </button>
                ))}
            </div>
            {opcoes.length === 1 && (
                <p className="text-xs text-slate-500">
                    {rota.pontos.length > (rota.ida_e_volta ? 3 : 2)
                        ? "Com paradas, o Google mostra só um caminho."
                        : "O Google encontrou só este caminho."}
                </p>
            )}
        </div>
    )
}
