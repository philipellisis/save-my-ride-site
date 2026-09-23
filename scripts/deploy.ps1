<#
.SYNOPSIS
  Builds and deploys the Save My Ride backend (SAM) and frontend (Angular -> S3/CloudFront).

.PARAMETER SkipBackend
  Skip `sam build`/`sam deploy` and only rebuild + republish the frontend
  (useful after a pure UI change, when the backend stack hasn't changed).
#>
param(
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$stackName = "savemyride-website"

if (-not $SkipBackend) {
  Write-Host "==> sam build" -ForegroundColor Cyan
  sam build
  if ($LASTEXITCODE -ne 0) { throw "sam build failed" }

  Write-Host "==> sam deploy" -ForegroundColor Cyan
  # --no-fail-on-empty-changeset: sam deploy otherwise exits non-zero when there's nothing new
  # to deploy at the infrastructure level, which would wrongly abort this script before it ever
  # gets to building/uploading the frontend (a legitimate, common case for a frontend-only change).
  sam deploy --no-fail-on-empty-changeset
  if ($LASTEXITCODE -ne 0) { throw "sam deploy failed" }
}

Write-Host "==> Reading stack outputs" -ForegroundColor Cyan
$outputsJson = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" --output json
if ($LASTEXITCODE -ne 0) { throw "Failed to read stack outputs. Has the stack been deployed yet?" }
$outputs = $outputsJson | ConvertFrom-Json

function Get-Output($key) {
  ($outputs | Where-Object { $_.OutputKey -eq $key }).OutputValue
}

$apiUrl = Get-Output "ApiUrl"
$bucket = Get-Output "SiteBucketName"
$distributionId = Get-Output "CloudFrontDistributionId"
$cloudFrontDomain = Get-Output "CloudFrontDomainName"

Write-Host "API URL:      $apiUrl"
Write-Host "Site bucket:  $bucket"
Write-Host "Distribution: $distributionId"

Write-Host "==> Building Angular app (production)" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
try {
  npm run build -- --configuration production
  if ($LASTEXITCODE -ne 0) { throw "Angular build failed" }
} finally {
  Pop-Location
}

$distDir = Join-Path $root "frontend/dist/frontend/browser"

Write-Host "==> Writing production runtime config" -ForegroundColor Cyan
@{ apiBaseUrl = $apiUrl } | ConvertTo-Json | Set-Content -Path (Join-Path $distDir "config.json") -Encoding utf8

Write-Host "==> Syncing to s3://$bucket" -ForegroundColor Cyan
aws s3 sync $distDir "s3://$bucket" --delete
if ($LASTEXITCODE -ne 0) { throw "s3 sync failed" }

Write-Host "==> Invalidating CloudFront cache" -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" | Out-Null

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "CloudFront domain: $cloudFrontDomain"
Write-Host "Once Cloudflare DNS points at that domain (see DEPLOYMENT.md), the site is live at https://save-my-ride.com"
