<#
    .SYNOPSIS
    Deploy IdaraOS container to Azure Container Apps.

    .DESCRIPTION
    Builds, pushes, and deploys the IdaraOS Docker image to Azure Container Apps.
    This script is typically called from CI/CD pipelines.

    .PARAMETER EnvironmentName
    Required. Environment name (dev, staging, prod).

    .PARAMETER Location
    Required. Azure location code (uks, eus, weu, etc.).

    .PARAMETER Sequence
    Required. Sequence number for resource naming (001, 002).

    .PARAMETER ImageTag
    Optional. Docker image tag. Defaults to commit SHA or 'latest'.

    .PARAMETER AppName
    Optional. Application name prefix. Default: idaraos

    .PARAMETER SkipBuild
    Optional switch. Skip Docker build and use existing image.

    .PARAMETER SharedSubscriptionId
    Optional. Subscription ID where ACR is located.

    .EXAMPLE
    ./deploy-aca-service.ps1 `
        -EnvironmentName "dev" `
        -Location "uks" `
        -Sequence "001" `
        -ImageTag "abc1234"
#>
[CmdletBinding()]
Param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$EnvironmentName,

    [Parameter(Mandatory = $true)]
    [string]$Location,

    [Parameter(Mandatory = $true)]
    [string]$Sequence,

    [Parameter(Mandatory = $false)]
    [string]$ImageTag,

    [Parameter(Mandatory = $false)]
    [string]$AppName = "idaraos",

    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory = $false)]
    [string]$SharedSubscriptionId
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Build Resource Names
# =============================================================================

$resourceGroupName = "rg-$AppName-$EnvironmentName-$Location-$Sequence"
$sharedResourceGroupName = "rg-$AppName-shared"
$acrName = "cr$AppName"
$containerAppEnvName = "cae-$AppName-$EnvironmentName"
$containerAppName = "$AppName-$EnvironmentName"
$keyVaultName = "kv-$AppName-$EnvironmentName-$Sequence"
$postgresqlName = "psql-$AppName-$EnvironmentName-$Location-$Sequence"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IdaraOS Container Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment: $EnvironmentName" -ForegroundColor Yellow
Write-Host "Resource Group: $resourceGroupName" -ForegroundColor Yellow
Write-Host "Container App: $containerAppName" -ForegroundColor Yellow
Write-Host ""

# =============================================================================
# Determine Image Tag
# =============================================================================

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
    # Try to get from environment (CI/CD)
    $ImageTag = $env:BUILD_SOURCEVERSION
    if ([string]::IsNullOrWhiteSpace($ImageTag)) {
        $ImageTag = $env:GITHUB_SHA
    }
    
    # Try git
    if ([string]::IsNullOrWhiteSpace($ImageTag)) {
        try {
            $gitCommit = git rev-parse --short HEAD 2>&1
            if ($LASTEXITCODE -eq 0) {
                $ImageTag = $gitCommit.Trim()
            }
        }
        catch { }
    }
    
    # Fallback
    if ([string]::IsNullOrWhiteSpace($ImageTag)) {
        $ImageTag = "latest"
    }
    else {
        # Truncate to 7 chars
        $ImageTag = $ImageTag.Substring(0, [Math]::Min(7, $ImageTag.Length))
    }
}

$imageRepository = $AppName
$fullImageName = "$acrName.azurecr.io/${imageRepository}:$ImageTag"
$latestImageName = "$acrName.azurecr.io/${imageRepository}:latest"

Write-Host "Image Tag: $ImageTag" -ForegroundColor Yellow
Write-Host "Full Image: $fullImageName" -ForegroundColor Yellow
Write-Host ""

# =============================================================================
# Get Current Subscription Info
# =============================================================================

$subscriptionInfo = az account show | ConvertFrom-Json
$currentSubId = $subscriptionInfo.id

Write-Host "Current Subscription: $($subscriptionInfo.name)" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# Verify Resources Exist
# =============================================================================

Write-Host "Verifying resources..." -ForegroundColor Cyan

# Verify resource group
$rgExists = az group exists --name $resourceGroupName 2>&1
if ($rgExists -ne "true") {
    throw "Resource group '$resourceGroupName' does not exist. Run init-infrastructure.ps1 first."
}
Write-Host "  Resource group: OK" -ForegroundColor Green

# Verify Container App Environment
$caeExists = az containerapp env show --resource-group $resourceGroupName --name $containerAppEnvName 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Container Apps Environment '$containerAppEnvName' does not exist."
}
Write-Host "  Container Apps Environment: OK" -ForegroundColor Green

# =============================================================================
# Get ACR Credentials
# =============================================================================

Write-Host ""
Write-Host "Getting ACR credentials..." -ForegroundColor Cyan

# Switch to shared subscription if needed
$sharedSubId = $SharedSubscriptionId
if ([string]::IsNullOrWhiteSpace($sharedSubId)) {
    $sharedSubId = $currentSubId
}

if ($sharedSubId -ne $currentSubId) {
    az account set --subscription $sharedSubId 2>&1 | Out-Null
}

# Login to ACR
az acr login --name $acrName 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to login to ACR '$acrName'"
}
Write-Host "  ACR login: OK" -ForegroundColor Green

# Get credentials
$acrCreds = az acr credential show --name $acrName | ConvertFrom-Json
$acrUsername = $acrCreds.username
$acrPassword = $acrCreds.passwords[0].value

# Switch back
if ($sharedSubId -ne $currentSubId) {
    az account set --subscription $currentSubId 2>&1 | Out-Null
}

Write-Host ""

# =============================================================================
# Build and Push Docker Image (if not skipping)
# =============================================================================

if (-not $SkipBuild) {
    Write-Host "Building Docker image..." -ForegroundColor Cyan
    
    # Find repo root (where Dockerfile context should be)
    $scriptDir = Split-Path -Parent $PSScriptRoot
    $repoRoot = Split-Path -Parent $scriptDir
    
    # Build
    $env:DOCKER_BUILDKIT = "1"
    docker build `
        -f "$repoRoot/deployment/docker/Dockerfile" `
        -t $fullImageName `
        -t $latestImageName `
        $repoRoot

    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }
    Write-Host "  Build: OK" -ForegroundColor Green

    # Push
    Write-Host "Pushing image to ACR..." -ForegroundColor Cyan
    docker push $fullImageName
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed for $fullImageName"
    }
    
    docker push $latestImageName
    Write-Host "  Push: OK" -ForegroundColor Green
}
else {
    Write-Host "Skipping build (using existing image)" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Get Secrets from Key Vault
# =============================================================================

Write-Host "Retrieving secrets from Key Vault..." -ForegroundColor Cyan

$jwtSecret = az keyvault secret show --vault-name $keyVaultName --name "jwt-secret" --query "value" -o tsv 2>&1
$encryptionKey = az keyvault secret show --vault-name $keyVaultName --name "encryption-key" --query "value" -o tsv 2>&1
$pgPassword = az keyvault secret show --vault-name $keyVaultName --name "pg-password" --query "value" -o tsv 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Warning: Could not retrieve secrets from Key Vault" -ForegroundColor Yellow
    Write-Host "  Container App will need secrets configured manually" -ForegroundColor Yellow
}
else {
    Write-Host "  Secrets retrieved: OK" -ForegroundColor Green
}

# Build DATABASE_URL
$databaseUrl = "postgresql://pgadmin:$pgPassword@$postgresqlName.postgres.database.azure.com:5432/$AppName?sslmode=require"

Write-Host ""

# =============================================================================
# Deploy to Container App
# =============================================================================

Write-Host "Deploying to Container App..." -ForegroundColor Cyan

# Check if container app exists
$appExists = az containerapp show --resource-group $resourceGroupName --name $containerAppName 2>&1

if ($LASTEXITCODE -ne 0) {
    # Create new container app
    Write-Host "  Creating new Container App..." -ForegroundColor Yellow

    az containerapp create `
        --name $containerAppName `
        --resource-group $resourceGroupName `
        --environment $containerAppEnvName `
        --image $fullImageName `
        --registry-server "$acrName.azurecr.io" `
        --registry-username $acrUsername `
        --registry-password $acrPassword `
        --target-port 3000 `
        --ingress external `
        --cpu 0.5 `
        --memory 1.0Gi `
        --min-replicas 1 `
        --max-replicas 3 `
        --env-vars "NODE_ENV=production" "DATABASE_URL=$databaseUrl" "JWT_SECRET=$jwtSecret" "ENCRYPTION_KEY=$encryptionKey" `
        --output none

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Container App"
    }
    Write-Host "  Container App created" -ForegroundColor Green
}
else {
    # Update existing container app
    Write-Host "  Updating existing Container App..." -ForegroundColor Yellow

    # Update secrets
    az containerapp secret set `
        --name $containerAppName `
        --resource-group $resourceGroupName `
        --secrets "registry-password=$acrPassword" `
        --output none 2>&1 | Out-Null

    # Update container
    az containerapp update `
        --name $containerAppName `
        --resource-group $resourceGroupName `
        --image $fullImageName `
        --set-env-vars "NODE_ENV=production" "DATABASE_URL=$databaseUrl" "JWT_SECRET=$jwtSecret" "ENCRYPTION_KEY=$encryptionKey" `
        --output none

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to update Container App"
    }
    Write-Host "  Container App updated" -ForegroundColor Green
}

Write-Host ""

# =============================================================================
# Get Application URL
# =============================================================================

$app = az containerapp show --resource-group $resourceGroupName --name $containerAppName | ConvertFrom-Json
$fqdn = $app.properties.configuration.ingress.fqdn
$appUrl = "https://$fqdn"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL: $appUrl" -ForegroundColor Cyan
Write-Host "Image: $fullImageName" -ForegroundColor Gray
Write-Host ""

# Output for CI/CD
Write-Host "##vso[task.setvariable variable=APP_URL;isOutput=true]$appUrl"
Write-Host "##[set-output name=app_url]$appUrl"

return $appUrl
