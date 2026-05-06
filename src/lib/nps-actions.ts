'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

// "gabriel bacellar e ana gabriela sao a mesma pessoa"
const ALIASES: Record<string, string> = {
    'ana gabriela': 'gabriel bacellar',
};

// Strip accents and collapse whitespace so "João Gabriel" and "joao gabriel" match
const normalizeName = (s: string) =>
    s.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

// Mapeamento dos meses (ex: "Janeiro" -> 1)
const MONTHS: Record<string, number> = {
    'janeiro': 1,
    'fevereiro': 2,
    'março': 3,
    'marco': 3,
    'abril': 4,
    'maio': 5,
    'junho': 6,
    'julho': 7,
    'agosto': 8,
    'setembro': 9,
    'outubro': 10,
    'novembro': 11,
    'dezembro': 12
};

export async function importNpsData(rows: Record<string, unknown>[]) {
    try {
        const supabase = createServerSupabaseClient();
        
        const userNps: Record<string, Record<string, unknown>[]> = {};

        for (const r of rows) {
            // Find keys dynamically to handle differences in accents or extra spaces
            const kNome = Object.keys(r).find(k => k.toLowerCase().trim() === 'nome') || 'Nome';
            const kPeriodo = Object.keys(r).find(k => k.toLowerCase().trim() === 'período' || k.toLowerCase().trim() === 'periodo') || 'Período';
            
            let n = typeof r[kNome] === 'string' ? r[kNome].trim() : '';
            if (!n) continue;
            
            let normalizedName = normalizeName(n);
            if (ALIASES[normalizedName]) {
                normalizedName = ALIASES[normalizedName];
            }
            n = normalizedName;

            const periodo = typeof r[kPeriodo] === 'string' ? r[kPeriodo].trim().toLowerCase() : '';
            if (periodo.includes('geral')) continue; 

            const mes = MONTHS[periodo];
            if (!mes) continue; 

            if (!userNps[n]) {
                userNps[n] = [];
            }

            const parseNum = (keyWord: string) => {
                const actualKey = Object.keys(r).find(k => k.toLowerCase().includes(keyWord.toLowerCase()));
                if (!actualKey) return null;
                const val = r[actualKey];
                if (!val || val === 'N/A' || val === '#N/A' || String(val).trim() === '') return null;
                const parsed = parseFloat(String(val).replace(',', '.'));
                return isNaN(parsed) ? null : parsed;
            };

            userNps[n].push({
                mes: mes,
                ano: new Date().getFullYear(),
                nps_geral: parseNum('NPS'),
                comunicacao: parseNum('Comunica'),
                suporte: parseNum('Suporte'),
                relacionamento: parseNum('Relacionamento'),
                resolutividade: parseNum('Resolutividade'),
                lideranca: parseNum('Lideran'),
                dedicacao: parseNum('Dedica'),
                confianca: parseNum('Confian'),
                pontualidade: parseNum('Pontualidade'),
                organizacao: parseNum('Organiza'),
                proatividade: parseNum('Proatividade'),
                qualidade_entregas: parseNum('Qualidade'),
                dominio_tecnico: parseNum('Domínio') || parseNum('Dominio')
            });
        }

        const { data: preCad } = await supabase.from('membros_pre_cadastro').select('id, nome, nps_data');
        if (!preCad) return { success: false, error: 'Erro ao buscar membros pré-cadastrados' };

        let updatedCount = 0;

        for (const [lowerName, npsRows] of Object.entries(userNps)) {
            // "gabriel bacellar e ana gabriela sao a mesma pessoa"
            let targetName = lowerName;
            if (targetName === 'ana gabriela' || targetName === 'gabriel bacellar') {
                targetName = 'gabriela bacelar'; // This matches the specific DB entry found previously
            }

            const members = preCad.filter(m => {
                const dbName = normalizeName(m.nome);
                return dbName === targetName
                    || dbName.includes(targetName)
                    || targetName.includes(dbName)
                    || lowerName.includes(dbName);
            });

            if (members.length > 0) {
                // We'll update all matched members just in case
                for (const member of members) {
                    // merge with existing? Just replace for simplicity or push. Let's merge by mes/ano.
                    const existingData = (member.nps_data || []) as Record<string, unknown>[];
                    const mergedData = [...existingData];
                    
                    for (const row of npsRows) {
                        const existingIdx = mergedData.findIndex(m => m.mes === row.mes && m.ano === row.ano);
                        if (existingIdx >= 0) {
                            mergedData[existingIdx] = { ...mergedData[existingIdx], ...row };
                        } else {
                            mergedData.push(row);
                        }
                    }

                    const { error } = await supabase
                        .from('membros_pre_cadastro')
                        .update({ nps_data: mergedData })
                        .eq('id', member.id);
                    
                    if (!error) updatedCount++;
                }
            } else {
                console.log("Nenhum membro pré-cadastrado encontrado para:", lowerName);
            }
        }

        return { success: true, updatedCount };
    } catch (e: unknown) {
        return { success: false, error: (e as Error).message || 'Erro interno' };
    }
}
