// Turns .env into env.json for `sam local start-api --env-vars env.json`.
// Local Lambda invocations still talk to the REAL Airtable base, DynamoDB table,
// and Bedrock — there's no local mocking — so TABLE_NAME must point at a table
// that actually exists (the one from your deployed stack, by default).
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const envPath = join(root, '.env');

if (!existsSync(envPath)) {
  console.error('.env not found at repo root. Copy .env.example to .env and fill in your Airtable credentials first.');
  process.exit(1);
}

const tableNameArgIndex = process.argv.indexOf('--table-name');
const tableName =
  tableNameArgIndex !== -1 ? process.argv[tableNameArgIndex + 1] : 'savemyride-website-appointments';

const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?$/);
  if (match) env[match[1]] = match[2];
}

const parameters = {
  AIRTABLE_API_KEY: env.AIRTABLE_API_KEY ?? '',
  AIRTABLE_AUTOWORK_BASE_ID: env.AIRTABLE_AUTOWORK_BASE_ID ?? '',
  AIRTABLE_AUTOWORK_TABLE_ID: env.AIRTABLE_AUTOWORK_TABLE_ID ?? '',
  BEDROCK_MODEL_ID: env.BEDROCK_MODEL_ID ?? 'moonshotai.kimi-k2.5',
  TABLE_NAME: tableName,
  // Pinned to match samconfig.toml / template.yaml, which must deploy to us-east-1 (required for
  // the CloudFront ACM cert). Without this, local Lambda calls fall back to your AWS CLI's default
  // region, which may differ and cause a DynamoDB ResourceNotFoundException even after deploying.
  AWS_REGION: 'us-east-1',
};

writeFileSync(join(root, 'env.json'), JSON.stringify({ Parameters: parameters }, null, 2));
console.log(`Wrote env.json (TABLE_NAME=${tableName}). Run: sam local start-api --env-vars env.json`);
