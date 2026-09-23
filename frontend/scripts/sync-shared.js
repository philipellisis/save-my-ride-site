// Keeps public/repair-catalog.json in sync with the repo's single source of truth
// (../shared/repair-catalog.json) so it's never hand-edited in two places.
const { copyFileSync } = require('node:fs');
const { join } = require('node:path');

const src = join(__dirname, '..', '..', 'shared', 'repair-catalog.json');
const dest = join(__dirname, '..', 'public', 'repair-catalog.json');

copyFileSync(src, dest);
console.log('Synced repair-catalog.json from shared/ into public/');
