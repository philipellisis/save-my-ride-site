# Deployment Guide

One-time setup to get Save My Ride live at `save-my-ride.com`, with `savemyrides.com` redirecting
to it. Steps 1–4 are one-time; step 5 is what you run for every subsequent deploy.

## 0. Prerequisites check

```
sam --version      # needs to be recent enough to know about nodejs20.x (1.130+)
aws --version      # AWS CLI v2, with credentials configured (aws sts get-caller-identity)
```

If `sam build` later fails with `'nodejs20.x' runtime is not supported`, your SAM CLI install is
outdated — download the current installer from AWS and reinstall
(https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).

## 1. Enable Bedrock model access

Whatever model you use for repair estimates must be explicitly enabled per AWS account/region
before you can call it:

1. AWS Console → **Bedrock** → **Model access** (left nav) → region **us-east-1**.
2. Request/enable access to the model you want (currently configured: `moonshotai.kimi-k2.5`).
3. Once granted, note the exact model ID shown in the console — copy it exactly, since these ids
   are provider-specific and change over time.

### Changing the model later

The model is a plain config value, not hardcoded — change it any time with no code changes:

- **Local dev**: edit `BEDROCK_MODEL_ID` in `.env`, then re-run `npm run backend:local-env`.
- **Deployed stack**: `sam deploy --parameter-overrides BedrockModelId=<new-model-id>` (or update
  the `BedrockModelId` default in `template.yaml` and redeploy).

`backend/src/lib/bedrock.ts` first tries Bedrock's Converse tool-use API (best structured-output
fidelity) and, if the model/provider doesn't support tool-use at all, automatically falls back to
asking the model for plain JSON and parsing it — so most Bedrock text models will work here
without further code changes. If a new model still fails, it's usually a case of model access not
being granted yet, or the account/region not offering that model at all.

## 2. First deploy (backend + static hosting infra)

From the repo root:

```
sam build
sam deploy --guided
```

When prompted, provide:
- Stack name: `savemyride-website` (matches `samconfig.toml` / `scripts/deploy.ps1` — keep this
  unless you also update those files)
- Region: `us-east-1` (required — the CloudFront ACM certificate must be issued in us-east-1)
- Parameters: `AirtableApiKey`, `AirtableBaseId`, `AirtableTableId` from your `.env`;
  `BedrockModelId` if it differs from the template default; leave `DomainName` /
  `WwwDomainName` as the defaults unless your canonical domain changes.
- Confirm changes before deploy: Yes
- Save arguments to samconfig.toml: Yes (so future deploys are just `sam deploy`)

**The deploy will pause** while CloudFormation waits for the ACM certificate to validate — DNS
validation can't complete automatically because your domain is in Cloudflare, not Route 53.

### Validating the certificate in Cloudflare

While the stack is `CREATE_IN_PROGRESS`:

1. AWS Console → **Certificate Manager** (region us-east-1) → find the pending certificate for
   `save-my-ride.com`.
2. For each of the two domain rows (`save-my-ride.com` and `www.save-my-ride.com`), copy the CNAME
   **name** and **value** shown under "CNAME name" / "CNAME value".
3. In Cloudflare DNS for the domain, add a **CNAME** record for each:
   - Name: the CNAME name ACM gave you (minus the trailing `.save-my-ride.com` if Cloudflare adds
     the zone suffix automatically — paste the full host ACM shows and let Cloudflare normalize it)
   - Target: the CNAME value ACM gave you
   - Proxy status: **DNS only** (grey cloud) — a proxied validation record can prevent ACM from
     seeing it
4. Wait a few minutes; ACM will validate automatically and the stack will continue and finish.

## 3. Point Cloudflare DNS at the site

Once the stack finishes, get the CloudFront domain name:

```
aws cloudformation describe-stacks --stack-name savemyride-website \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" --output text
```

In Cloudflare DNS for **save-my-ride.com**:
- `CNAME` `save-my-ride.com` (root — Cloudflare supports CNAME flattening at the apex) → the
  CloudFront domain (e.g. `dxxxxxxxxxxxxx.cloudfront.net`)
- `CNAME` `www` → same CloudFront domain
- Proxy status: start with **DNS only** (grey cloud) to keep things simple; you can switch to
  proxied (orange cloud) later once everything works.
- SSL/TLS mode (Cloudflare → SSL/TLS → Overview): set to **Full** (CloudFront presents a valid
  ACM cert, so Full is safe; avoid "Flexible").

In Cloudflare for **savemyrides.com** (the domain you're retiring in favor of save-my-ride.com):
- Cloudflare → **Rules** → **Redirect Rules** → create a rule matching hostname
  `savemyrides.com` or `*savemyrides.com/*` → redirect to `https://save-my-ride.com$1`
  (301, preserve path/query). No AWS resources are needed for this — it's a free Cloudflare
  Redirect Rule.
- You still need at least one DNS record (e.g. an `A` record to `192.0.2.1`, proxied) for
  `savemyrides.com` so Cloudflare has something to intercept and apply the redirect rule to.

DNS propagation can take a few minutes to a few hours.

## 4. Publish the Angular app

```
./scripts/deploy.ps1
```

This builds the Angular app, points it at the deployed API Gateway URL, uploads it to the S3
bucket, and invalidates the CloudFront cache. Once DNS has propagated, https://save-my-ride.com
is live.

## 5. Every deploy after the first

```
./scripts/deploy.ps1
```

or, if you only changed the Angular app and not `template.yaml`/`backend/`:

```
./scripts/deploy.ps1 -SkipBackend
```

## Notes / things to revisit later

- The Airtable API key is stored as a `NoEcho` CloudFormation parameter, which keeps it out of
  the console/CFN template body, but it's still visible in plaintext to anyone with
  `lambda:GetFunctionConfiguration` on the account. For a small single-operator shop this is a
  reasonable tradeoff for simplicity; if that changes, move it to AWS Secrets Manager and have the
  Lambdas fetch it at runtime instead.
- `savemyrides.com` is handled entirely at the Cloudflare layer (redirect rule) — there's no
  second AWS stack, ACM cert, or CloudFront distribution for it, which keeps the AWS footprint
  smaller.
