const fs = require('fs');
const content = fs.readFileSync('nps-exemplo.csv', 'utf8');

const rows = content.split('\n').map(line => {
    // Basic CSV split considering quotes - simplified for this test
    const row = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === ',' && !inQuotes) {
            row.push(current);
            current = '';
        } else current += line[i];
    }
    row.push(current);
    return row.map(s => s.trim());
});

let year = new Date().getFullYear();
let colName = '';

// Find Year
for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
        const cell = rows[r][c] || '';
        const m = cell.match(/NPS (\d{4})/i);
        if (m) year = parseInt(m[1], 10);
        
        // Find name heuristically, row 5 col 14 in example
        if (r === 5 && cell && cell !== 'i') {
             // In example: cell 14 is Breno Colt
             colName = cell;
        }
    }
}

console.log('Year:', year);
console.log('Name from row 5:', rows[5][14]);

// Find NPS GERAL
const npsMap = {};
for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const npsIndex = row.indexOf('NPS GERAL');
    if (npsIndex !== -1) {
        // Next 12 rows
        for (let i = 1; i <= 12; i++) {
            if (!rows[r + i + 1]) break; // Skip the empty row or just check all next rows
            let candidateRow = rows[r + i + 1];
            // wait, in the CSV, between MÊS/NPS GERAL and JANEIRO there is an empty row (line 10)
        }
    }
}
