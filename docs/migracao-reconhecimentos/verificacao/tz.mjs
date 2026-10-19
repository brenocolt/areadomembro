const addDays = (iso, days) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
console.log(process.env.TZ, 'addDays(2026-01-01, 30) =', addDays('2026-01-01', 30), '(esperado 2026-01-31)');
