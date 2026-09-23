// Keeps src/lib/repair-catalog.json in sync with the repo's single source of truth
// (../../shared/repair-catalog.json). This has to be a real copy INSIDE backend/, not a
// cross-boundary relative import, because `sam build` only copies the CodeUri directory
// (backend/) into its isolated build scratch dir — it never sees sibling folders like shared/.
const { copyFileSync } = require('node:fs');
const { join } = require('node:path');

const src = join(__dirname, '..', '..', 'shared', 'repair-catalog.json');
const dest = join(__dirname, '..', 'src', 'lib', 'repair-catalog.json');

copyFileSync(src, dest);
console.log('Synced repair-catalog.json from shared/ into backend/src/lib/');
