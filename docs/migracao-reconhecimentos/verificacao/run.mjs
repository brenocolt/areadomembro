import { db } from './mock.mjs';
import { sincronizarBonificacoes } from './engine.ts';
const reset = () => { for (const k of Object.keys(db)) db[k].length = 0; };
const tipo = (id, nome) => db.reconhecimento_tipos.push({ id, nome });
const rg = (id, data, adi, projeto = 'P1') => db.reconhecimentos.push({ id, tipo_id: 'T-RG', data, projeto_id: projeto, projeto_nome: projeto, adiantado: adi, rg_adiantada: false, projeto_adiantado: false });
const regra = (o) => db.regras_bonificacao.push({ ativo: true, requer_projeto_adiantado: false, valor: 0, descricao_premiacao: '', quantidade_necessaria: 1, ciclo: 0, prazo_dias: null, ...o });
const out = (titulo) => console.log('\n## ' + titulo + '\n' + JSON.stringify(db.bonificacoes.map(b => ({ regra: b.regra_nome, marco: b.marco, chave: b.marco_chave.replace(/regra-|T-|rec-/g,''), liberada_em: b.liberada_em, prazo: b.prazo_limite, status: b.status, motivo: b.motivo, valor: b.valor })), null, 0));

// V1: acumulado com ciclo. 7 RGs adiantadas + 2 normais intercaladas, mesmo projeto.
reset(); tipo('T-RG', 'RG');
regra({ id: 'regra-12', nome: 'R12', tipo_id: 'T-RG', criterio: 'acumulado', quantidade_necessaria: 2, ciclo: 4, requer_rg_adiantada: true, tipo_premiacao: 'financeira', valor: 12 });
regra({ id: 'regra-30', nome: 'R30', tipo_id: 'T-RG', criterio: 'acumulado', quantidade_necessaria: 4, ciclo: 4, requer_rg_adiantada: true, tipo_premiacao: 'premio', valor: 30 });
['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05','2026-01-06','2026-01-07'].forEach((d,i)=>rg('rec-a'+(i+1), d, true));
rg('rec-n1','2026-01-08',false); rg('rec-n2','2026-01-09',false);
console.log('V1 novas =', await sincronizarBonificacoes()); out('V1 (7 adiantadas + 2 normais) -> esperado: R12 marcos 2 e 6; R30 marco 4');
// V1b: chega a 8ª e 10ª adiantada
rg('rec-a8','2026-02-01',true); rg('rec-a9','2026-02-02',true); rg('rec-a10','2026-02-03',true);
console.log('V1b novas =', await sincronizarBonificacoes()); out('V1b (10 adiantadas) -> esperado novos: R12 marco 10; R30 marco 8');
console.log('V1c idempotência novas =', await sincronizarBonificacoes());

// V2: por_reconhecimento, 3 registros, mesma pessoa; um reconhecimento apagado não remove nem recria
reset(); tipo('T-SDR','SDR');
regra({ id:'regra-sdr', nome:'SDR do Mês', tipo_id:'T-SDR', criterio:'por_reconhecimento', valor:50, descricao_premiacao:'R$ 50,00' });
['2026-03-01','2026-04-01','2026-05-01'].forEach((d,i)=>db.reconhecimentos.push({ id:'rec-s'+(i+1), tipo_id:'T-SDR', data:d, pessoa_nome:'Ana', adiantado:false, rg_adiantada:false, projeto_adiantado:false }));
console.log('V2 novas =', await sincronizarBonificacoes()); out('V2');
db.reconhecimentos.splice(1,1); // apaga rec-s2 (FK SET NULL não simulada)
console.log('V2b após apagar rec-s2, novas =', await sincronizarBonificacoes(), '| bonificações =', db.bonificacoes.length);

// V3: simbólica não gera; regra inativa não gera
reset(); tipo('T-X','X');
regra({ id:'regra-sim', nome:'Simb', tipo_id:'T-X', criterio:'simbolico' });
regra({ id:'regra-off', nome:'Off', tipo_id:'T-X', criterio:'por_reconhecimento', ativo:false });
db.reconhecimentos.push({ id:'rec-x1', tipo_id:'T-X', data:'2026-01-01', pessoa_nome:'Bia', adiantado:false, rg_adiantada:false, projeto_adiantado:false });
console.log('V3 novas =', await sincronizarBonificacoes());

// V4: prazo e expiração. prazo da regra 30 dias; config padrão 10 dias para outra regra; 0 = sem prazo
reset(); tipo('T-P','P');
db.bonificacoes_config.push({ id:'cfg', prazo_padrao_dias: 10 });
regra({ id:'regra-p30', nome:'P30', tipo_id:'T-P', criterio:'por_reconhecimento', prazo_dias: 30 });
regra({ id:'regra-pcfg', nome:'PCFG', tipo_id:'T-P', criterio:'por_reconhecimento', prazo_dias: null });
regra({ id:'regra-p0', nome:'P0', tipo_id:'T-P', criterio:'por_reconhecimento', prazo_dias: 0 });
db.reconhecimentos.push({ id:'rec-p1', tipo_id:'T-P', data:'2026-01-01', pessoa_nome:'Caio', adiantado:false, rg_adiantada:false, projeto_adiantado:false });
console.log('V4 novas =', await sincronizarBonificacoes()); out('V4 (prazos: P30=2026-01-31; PCFG=2026-01-11 (padrão 10); P0=sem prazo)');
console.log('V4b (hoje real > prazos) novas =', await sincronizarBonificacoes()); out('V4b expiração'); console.log('eventos:', db.bonificacao_eventos.map(e=>e.evento).join(','));
