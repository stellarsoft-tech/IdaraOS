<#
    .SYNOPSIS
    Register Entra ID (Azure AD) application for IdaraOS SSO.

    .DESCRIPTION
    Creates and configures an Entra ID application registration for:
    - OpenID Connect SSO authentication
    - Microsoft Graph API permissions
    - Redirect URIs for both local development and production

    .PARAMETER AppDisplayName
    Optional. Display name for the app registration. Default: IdaraOS

    .PARAMETER EnvironmentName
    Optional. Environment name (dev, staging, prod). Default: dev

    .PARAMETER ProductionUrl
    Optional. Production URL for redirect URI.

    .PARAMETER LocalHttpsPort
    Optional. Local HTTPS port. Default: 443

    .PARAMETER CreateClientSecret
    Optional switch. Creates a client secret for the application.

    .EXAMPLE
    # Basic local development setup
    ./register-entra-app.ps1

    .EXAMPLE
    # Production setup with client secret
    ./register-entra-app.ps1 `
        -AppDisplayName "IdaraOS Production" `
        -EnvironmentName "prod" `
        -ProductionUrl "https://idaraos.example.com" `
        -CreateClientSecret

    .EXAMPLE
    # With custom local port
    ./register-entra-app.ps1 -LocalHttpsPort 8443
#>
[CmdletBinding()]
Param(
    [Parameter(Mandatory = $false)]
    [string]$AppDisplayName = "IdaraOS",

    [Parameter(Mandatory = $false)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$EnvironmentName = "dev",

    [Parameter(Mandatory = $false)]
    [string]$ProductionUrl,

    [Parameter(Mandatory = $false)]
    [int]$LocalHttpsPort = 443,

    [Parameter(Mandatory = $false)]
    [switch]$CreateClientSecret
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Check Prerequisites
# =============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Entra ID App Registration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if logged in to Azure
Write-Host "Checking Azure CLI login status..." -ForegroundColor Gray
$account = az account show 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to Azure CLI. Please run 'az login' first." -ForegroundColor Red
    exit 1
}

Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "Tenant: $($account.tenantId)" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# Build App Name
# =============================================================================

$fullAppName = if ($EnvironmentName -eq "prod") {
    $AppDisplayName
} else {
    "$AppDisplayName ($EnvironmentName)"
}

Write-Host "App Display Name: $fullAppName" -ForegroundColor Yellow
Write-Host ""

# =============================================================================
# Build Redirect URIs
# =============================================================================

Write-Host "Configuring Redirect URIs..." -ForegroundColor Cyan
Write-Host ""

# Local development URIs (HTTPS)
$redirectUris = @(
    "https://localhost/api/auth/callback/azure-ad",
    "https://localhost/api/auth/callback/entra",
    "https://localhost:$LocalHttpsPort/api/auth/callback/azure-ad",
    "https://localhost:$LocalHttpsPort/api/auth/callback/entra",
    "https://idaraos.local/api/auth/callback/azure-ad",
    "https://idaraos.local/api/auth/callback/entra"
)

# Add HTTP for fallback (some dev scenarios)
$redirectUris += @(
    "http://localhost:3000/api/auth/callback/azure-ad",
    "http://localhost:3000/api/auth/callback/entra"
)

# Add production URL if provided
if (-not [string]::IsNullOrWhiteSpace($ProductionUrl)) {
    $productionUrlTrimmed = $ProductionUrl.TrimEnd('/')
    $redirectUris += @(
        "$productionUrlTrimmed/api/auth/callback/azure-ad",
        "$productionUrlTrimmed/api/auth/callback/entra"
    )
    Write-Host "  Production URL: $productionUrlTrimmed" -ForegroundColor Gray
}

Write-Host "  Redirect URIs:" -ForegroundColor Gray
foreach ($uri in $redirectUris) {
    Write-Host "    - $uri" -ForegroundColor Gray
}
Write-Host ""

# =============================================================================
# Check if App Already Exists
# =============================================================================

Write-Host "Checking for existing app registration..." -ForegroundColor Gray

$existingApp = az ad app list --display-name $fullAppName --query "[0]" 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($existingApp -and $existingApp.appId) {
    Write-Host "App registration already exists: $($existingApp.appId)" -ForegroundColor Yellow
    Write-Host ""
    
    $updateChoice = Read-Host "Update existing app registration? (Y/n)"
    if ($updateChoice -eq 'n' -or $updateChoice -eq 'N') {
        Write-Host "Aborted by user." -ForegroundColor Yellow
        exit 0
    }
    
    $appId = $existingApp.appId
    $objectId = $existingApp.id
    
    # Update redirect URIs
    Write-Host "Updating redirect URIs..." -ForegroundColor Yellow
    $uriJson = $redirectUris | ConvertTo-Json -Compress
    
    az ad app update `
        --id $appId `
        --web-redirect-uris $redirectUris `
        --output none
    
    Write-Host "Redirect URIs updated" -ForegroundColor Green
}
else {
    # =============================================================================
    # Create New App Registration
    # =============================================================================
    
    Write-Host "Creating new app registration..." -ForegroundColor Yellow
    
    # Create the app with required settings
    $appResult = az ad app create `
        --display-name $fullAppName `
        --sign-in-audience "AzureADMyOrg" `
        --web-redirect-uris $redirectUris `
        --enable-id-token-issuance true `
        --enable-access-token-issuance false `
        --query "{appId: appId, id: id}" `
        --output json | ConvertFrom-Json
    
    $appId = $appResult.appId
    $objectId = $appResult.id
    
    Write-Host "App registration created" -ForegroundColor Green
    Write-Host "  Application (client) ID: $appId" -ForegroundColor Gray
    Write-Host "  Object ID: $objectId" -ForegroundColor Gray
    Write-Host ""
    
    # =============================================================================
    # Configure API Permissions
    # =============================================================================
    
    Write-Host "Configuring API permissions..." -ForegroundColor Yellow
    
    # Microsoft Graph permissions
    # User.Read (delegated) - Sign in and read user profile
    $graphResourceId = "00000003-0000-0000-c000-000000000000"
    $userReadPermission = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"  # User.Read
    
    az ad app permission add `
        --id $appId `
        --api $graphResourceId `
        --api-permissions "$userReadPermission=Scope" `
        --output none
    
    Write-Host "  Added User.Read permission" -ForegroundColor Gray
    
    # Optional: Add additional Graph permissions for user sync
    # User.ReadBasic.All (delegated) - Read all users' basic profiles
    $userReadBasicAll = "b340eb25-3456-403f-be2f-af7a0d370277"
    
    az ad app permission add `
        --id $appId `
        --api $graphResourceId `
        --api-permissions "$userReadBasicAll=Scope" `
        --output none
    
    Write-Host "  Added User.ReadBasic.All permission" -ForegroundColor Gray
    Write-Host ""
    
    # =============================================================================
    # Create Service Principal
    # =============================================================================
    
    Write-Host "Creating service principal..." -ForegroundColor Yellow
    
    $spExists = az ad sp show --id $appId 2>&1
    if ($LASTEXITCODE -ne 0) {
        az ad sp create --id $appId --output none
        Write-Host "Service principal created" -ForegroundColor Green
    }
    else {
        Write-Host "Service principal already exists" -ForegroundColor Green
    }
    Write-Host ""
}

# =============================================================================
# Create Client Secret (Optional)
# =============================================================================

$clientSecret = $null

if ($CreateClientSecret) {
    Write-Host "Creating client secret..." -ForegroundColor Yellow
    
    $secretResult = az ad app credential reset `
        --id $appId `
        --display-name "IdaraOS Secret ($EnvironmentName)" `
        --years 2 `
        --query "password" `
        --output tsv
    
    $clientSecret = $secretResult
    
    Write-Host "Client secret created" -ForegroundColor Green
    Write-Host ""
}

# =============================================================================
# Summary
# =============================================================================

Write-Host "========================================" -ForegroundColor Green
Write-Host "App Registration Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application Details:" -ForegroundColor Cyan
Write-Host "  Display Name:           $fullAppName" -ForegroundColor Gray
Write-Host "  Application (client) ID: $appId" -ForegroundColor Yellow
Write-Host "  Tenant ID:              $($account.tenantId)" -ForegroundColor Yellow
Write-Host ""

if ($clientSecret) {
    Write-Host "Client Secret:" -ForegroundColor Cyan
    Write-Host "  $clientSecret" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Save this secret now! It cannot be retrieved later." -ForegroundColor Red
    Write-Host ""
}

Write-Host "Redirect URIs (HTTPS):" -ForegroundColor Cyan
foreach ($uri in $redirectUris | Where-Object { $_ -like "https://*" }) {
    Write-Host "  $uri" -ForegroundColor Gray
}
Write-Host ""

Write-Host "Environment Variables for .env.local:" -ForegroundColor Cyan
Write-Host "  AZURE_AD_CLIENT_ID=$appId" -ForegroundColor Yellow
Write-Host "  AZURE_AD_TENANT_ID=$($account.tenantId)" -ForegroundColor Yellow
if ($clientSecret) {
    Write-Host "  AZURE_AD_CLIENT_SECRET=$clientSecret" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Copy the environment variables above to your .env.local file" -ForegroundColor Gray
Write-Host "  2. Grant admin consent for API permissions in Azure Portal (if required)" -ForegroundColor Gray
Write-Host "     https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$appId" -ForegroundColor Gray
Write-Host "  3. Start the application with HTTPS: docker-compose -f docker-compose.dev.yml up" -ForegroundColor Gray
Write-Host ""
