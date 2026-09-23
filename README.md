# Save My Ride — Website

Angular frontend + AWS Lambda/DynamoDB/Bedrock backend for Save My Ride's booking site. Airtable
(`Work` table) is the source of truth for appointments; DynamoDB is a read-optimized cache that's
lazily refreshed from Airtable (see "How syncing works" below).

```
frontend/    Angular app (home page + booking wizard)
backend/     Lambda handlers (get-schedule, estimate-repair, create-booking)
shared/      repair-catalog.json — single source of truth for repair types/baseline hours
template.yaml  SAM template: DynamoDB, 3 Lambdas, HTTP API, S3 + CloudFront, ACM cert
scripts/     Deployment + local-dev helper scripts
```

## Prerequisites

- Node.js 20+, npm
- AWS SAM CLI **1.130+** (this template uses the `nodejs20.x` Lambda runtime — if `sam build`
  says `'nodejs20.x' runtime is not supported`, your SAM CLI is too old; upgrade it:
  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- AWS CLI v2, configured with credentials that can deploy CloudFormation/Lambda/DynamoDB/S3/CloudFront/ACM
- Bedrock model access for Claude Sonnet enabled in your AWS account/region (Bedrock console →
  Model access). See DEPLOYMENT.md.
- `.env` at the repo root with your Airtable credentials (copy `.env.example`)

If `npm run backend:build` fails with `Cannot find esbuild`, `npm run install:all` should fix it
(a `prebackend:build` hook also runs this automatically). If it still can't find `esbuild` after
that, install it on your system PATH as a fallback: `npm install -g esbuild`.

## Local development

Local dev runs the real backend logic against your **real** Airtable base, a **real** DynamoDB
table, and **real** Bedrock — there's no mocking. Deploy the stack once (see DEPLOYMENT.md) so a
DynamoDB table exists, then:

1. Install dependencies:
   ```
   npm run install:all
   ```

2. Generate `env.json` for the local Lambda runtime from your `.env`:
   ```
   npm run backend:local-env
   ```
   By default this points `TABLE_NAME` at `savemyride-website-appointments` (the table name for
   the default stack name). Pass `-- --table-name <name>` if you used a different stack name.

3. Build the Lambda bundles, then start the API locally (port 3000):
   ```
   npm run backend:build
   npm run backend:local-api
   ```
   Re-run `npm run backend:build` any time you change backend code — `sam local start-api` serves
   whatever was last built, it doesn't rebuild automatically.
   Leave this running. Test it directly if you like:
   ```
   curl http://localhost:3000/schedule
   ```

4. In another terminal, start the Angular dev server (port 4200):
   ```
   npm run frontend:dev
   ```
   `frontend/public/config.json` already points at `http://localhost:3000` for local dev — no
   changes needed. Open http://localhost:4200 and walk through the booking wizard: vehicle/repair
   → AI estimate → pick a time → confirm. A successful booking creates a real record in your
   Airtable `Work` table.

## Editing the repair catalog

`shared/repair-catalog.json` is the single source of truth for the repair dropdown and the
baseline hours given to Bedrock as context. Edit it, then re-run `npm run frontend:dev` /
`npm run frontend:build` (a `prestart`/`prebuild` hook copies it into `frontend/public/`
automatically).

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full first-time setup (Bedrock model access, SAM
deploy, ACM certificate validation, and pointing Cloudflare DNS at the site). After the first
deploy, redeploy anytime with:

```
./scripts/deploy.ps1
```

(`./scripts/deploy.ps1 -SkipBackend` if you only changed the Angular app.)
