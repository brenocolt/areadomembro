const bcrypt = require('bcryptjs');
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    // 1. Add paginas_permitidas column (text array) if not exists
    console.log("Adding paginas_permitidas column...");
    const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paginas_permitidas text[] DEFAULT NULL;`
    }).maybeSingle();
    
    // If rpc doesn't exist, try raw SQL via REST
    if (alterError) {
        console.log("RPC not available, trying direct SQL...");
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paginas_permitidas text[] DEFAULT NULL;` })
        });
        if (!res.ok) {
            console.log("Note: Could not add column via RPC. Please run this SQL manually:");
            console.log("  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS paginas_permitidas text[] DEFAULT NULL;");
        }
    }
    console.log("Column step done.");

    // 2. Create admin colaborador + user
    const adminEmail = "admin@produtiva.com";
    const adminPassword = "admin123";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Check if admin already exists
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', adminEmail)
        .single();

    if (existing) {
        console.log("Admin user already exists. Updating role to ADMIN...");
        await supabase.from('users').update({ role: 'ADMIN', paginas_permitidas: null }).eq('email', adminEmail);
        console.log("Done!");
        return;
    }

    // Create colaborador first
    const { data: col, error: colErr } = await supabase.from('colaboradores').insert({
        nome: 'Administrador',
        email_corporativo: adminEmail,
        matricula: 'ADM-001',
        cargo_atual: 'Administrador',
        nucleo_atual: 'Gestão',
        pontos_acumulados: 0,
        milhas: 0,
        nivel_consultor: 'Admin',
        saldo_pipj: 0,
        projetos: 0,
    }).select('id').single();

    if (colErr) {
        console.error("Error creating colaborador:", colErr.message);
        return;
    }

    // Create user with same id
    const { error: userErr } = await supabase.from('users').insert({
        id: col.id,
        email: adminEmail,
        senha: hashedPassword,
        role: 'ADMIN',
        colaborador_id: col.id,
        paginas_permitidas: null, // null = full access for ADMIN
    });

    if (userErr) {
        console.error("Error creating user:", userErr.message);
        return;
    }

    console.log("✅ Admin account created successfully!");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: ADMIN`);
}

main().catch(console.error);
