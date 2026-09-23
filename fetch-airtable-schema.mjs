// Fetches the field schema (names + types) for the AutoWork Airtable table
// and saves it to airtable-schema.json for reference in future tasks.
import { writeFileSync } from 'node:fs';

process.loadEnvFile();

const { AIRTABLE_API_KEY, AIRTABLE_AUTOWORK_BASE_ID, AIRTABLE_AUTOWORK_TABLE_ID } = process.env;

if (!AIRTABLE_API_KEY || !AIRTABLE_AUTOWORK_BASE_ID || !AIRTABLE_AUTOWORK_TABLE_ID) {
  console.error('Missing AIRTABLE_API_KEY, AIRTABLE_AUTOWORK_BASE_ID, or AIRTABLE_AUTOWORK_TABLE_ID in .env');
  process.exit(1);
}

const res = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_AUTOWORK_BASE_ID}/tables`, {
  headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
});

if (!res.ok) {
  throw new Error(`Airtable API error ${res.status}: ${await res.text()}`);
}

const data = await res.json();
const table = data.tables.find((t) => t.id === AIRTABLE_AUTOWORK_TABLE_ID);

if (!table) {
  throw new Error(`Table ${AIRTABLE_AUTOWORK_TABLE_ID} not found in base ${AIRTABLE_AUTOWORK_BASE_ID}`);
}

const schema = {
  tableId: table.id,
  tableName: table.name,
  primaryFieldId: table.primaryFieldId,
  fields: table.fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    ...(f.options ? { options: f.options } : {}),
  })),
};

writeFileSync('airtable-schema.json', JSON.stringify(schema, null, 2));
console.log(`Saved schema for table "${table.name}" (${schema.fields.length} fields) to airtable-schema.json`);
