
const { Client } = require('pg');

async function createTables() {
    const connectionString = process.env.DATABASE_URL.replace('?pgbouncer=true', '');
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL");

        const setupQuery = `
            CREATE TABLE IF NOT EXISTS pdi_planos (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
                titulo TEXT NOT NULL,
                descricao TEXT,
                status TEXT DEFAULT 'Em Dia',
                progresso NUMERIC DEFAULT 0,
                data_prazo TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS pdi_tarefas (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                plano_id UUID REFERENCES pdi_planos(id) ON DELETE CASCADE,
                titulo TEXT NOT NULL,
                descricao TEXT,
                tipo TEXT NOT NULL,
                status TEXT DEFAULT 'PENDENTE',
                anexos JSONB DEFAULT '[]'::jsonb,
                data_conclusao TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- Function to update progresso automatically
            CREATE OR REPLACE FUNCTION update_pdi_progresso()
            RETURNS TRIGGER AS $$
            DECLARE
                total_tarefas INT;
                concluidas INT;
                novo_progresso NUMERIC;
            BEGIN
                total_tarefas := (SELECT COUNT(*) FROM pdi_tarefas WHERE plano_id = NEW.plano_id);
                concluidas := (SELECT COUNT(*) FROM pdi_tarefas WHERE plano_id = NEW.plano_id AND status = 'CONCLUIDO');
                
                IF total_tarefas > 0 THEN
                    novo_progresso := (concluidas::NUMERIC / total_tarefas::NUMERIC) * 100;
                ELSE
                    novo_progresso := 0;
                END IF;

                UPDATE pdi_planos SET progresso = novo_progresso WHERE id = NEW.plano_id;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            -- Trigger for when task is updated
            DROP TRIGGER IF EXISTS trg_update_pdi_progresso ON pdi_tarefas;
            CREATE TRIGGER trg_update_pdi_progresso
            AFTER INSERT OR UPDATE OR DELETE ON pdi_tarefas
            FOR EACH ROW EXECUTE FUNCTION update_pdi_progresso();
        `;

        await client.query(setupQuery);
        console.log("Tables 'pdi_planos' and 'pdi_tarefas' created successfully.");

        // Create some initial mock data
        const { rows: colabs } = await client.query(`SELECT id FROM colaboradores LIMIT 10`);
        if (colabs.length > 0) {
            // Check if there are already plans
            const { rows: existingPlans } = await client.query(`SELECT id FROM pdi_planos LIMIT 1`);

            if (existingPlans.length === 0) {
                console.log("Inserting mock data...");
                let cIndex = 0;

                // Let's populate 4 users
                for (let j = 0; j < Math.min(4, colabs.length); j++) {
                    const statusCycle = ['Em Dia', 'Finalizando', 'Atrasado', 'Em Dia'][j];
                    const progressoCycle = [65, 90, 30, 50][j];

                    const { rows: newPlan } = await client.query(`
                        INSERT INTO pdi_planos (colaborador_id, titulo, descricao, status, progresso, data_prazo)
                        VALUES ($1, 'Capacitação ' || $2 || ' - Planilhas e Liderança', 'Módulo focado no domínio avançado.', $3, $4, NOW() + interval '30 days')
                        RETURNING id
                    `, [colabs[j].id, j + 1, statusCycle, progressoCycle]);

                    const planId = newPlan[0].id;

                    // Insert tasks for this plan
                    await client.query(`
                        INSERT INTO pdi_tarefas (plano_id, titulo, tipo, status, anexos, data_conclusao)
                        VALUES ($1, 'Treinamento: Fórmulas Avançadas', 'video', 'CONCLUIDO', '[{"nome":"Link do Vídeo", "url":"#", "tipo":"link"}, {"nome":"Guia de Estudo.pdf", "url":"#", "tipo":"pdf"}]'::jsonb, NOW())
                    `, [planId]);

                    await client.query(`
                        INSERT INTO pdi_tarefas (plano_id, titulo, tipo, status, anexos, data_conclusao)
                        VALUES ($1, 'Materiais complementares', 'leitura', 'CONCLUIDO', '[{"nome":"Planilha de Exercícios.xlsx", "url":"#", "tipo":"doc"}, {"nome":"Documentação Oficial", "url":"#", "tipo":"doc"}]'::jsonb, NOW())
                    `, [planId]);

                    await client.query(`
                        INSERT INTO pdi_tarefas (plano_id, titulo, tipo, status, anexos)
                        VALUES ($1, 'Atividade: Consolidação de Dashboards', 'atividade', 'PENDENTE', '[{"nome":"Entrega_Final.zip", "url":"#", "tipo":"doc"}]'::jsonb)
                    `, [planId]);
                }
                console.log("Mock data inserted.");
            }
        }

    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        await client.end();
    }
}

createTables();
