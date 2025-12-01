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
# Helper Functions
# =============================================================================

<#
    .SYNOPSIS
    Get existing API permissions for an app registration
#>
function Get-ExistingPermissions {
    param(
        [string]$AppId,
        [string]$ResourceId
    )
    
    try {
        $app = az ad app show --id $AppId --query "requiredResourceAccess[?resourceAppId=='$ResourceId']" 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        if ($app -and $app.Count -gt 0) {
            $permissions = @()
            foreach ($resourceAccess in $app[0].resourceAccess) {
                $permissions += $resourceAccess.id
            }
            return $permissions
        }
        return @()
    }
    catch {
        return @()
    }
}

<#
    .SYNOPSIS
    Check if a permission already exists and add it if missing
#>
function Add-PermissionIfMissing {
    param(
        [string]$AppId,
        [string]$ResourceId,
        [string]$PermissionId,
        [string]$PermissionType,  # "Scope" or "Role"
        [string]$PermissionName
    )
    
    $existingPermissions = Get-ExistingPermissions -AppId $AppId -ResourceId $ResourceId
    
    if ($existingPermissions -contains $PermissionId) {
        Write-Host "    ✓ $PermissionName already exists (skipping)" -ForegroundColor Green
        return $false
    }
    else {
        az ad app permission add `
            --id $AppId `
            --api $ResourceId `
            --api-permissions "$PermissionId=$PermissionType" `
            --output none 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    + Added $PermissionName" -ForegroundColor Yellow
            return $true
        }
        else {
            Write-Host "    ✗ Failed to add $PermissionName" -ForegroundColor Red
            return $false
        }
    }
}

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
    Write-Host ""
    
    # =============================================================================
    # Update API Permissions (for existing app) - Idempotent
    # =============================================================================
    
    Write-Host "Checking existing API permissions..." -ForegroundColor Yellow
    $graphResourceId = "00000003-0000-0000-c000-000000000000"
    
    # Check what permissions already exist
    $existingPermissions = Get-ExistingPermissions -AppId $appId -ResourceId $graphResourceId
    
    if ($existingPermissions.Count -gt 0) {
        Write-Host "  Found $($existingPermissions.Count) existing permission(s)" -ForegroundColor Gray
    }
    else {
        Write-Host "  No existing permissions found" -ForegroundColor Gray
    }
    Write-Host ""
    
    $addPermissions = Read-Host "Ensure SCIM sync permissions are configured? (Y/n)"
    if ($addPermissions -ne 'n' -and $addPermissions -ne 'N') {
        Write-Host "Ensuring API permissions are configured (idempotent)..." -ForegroundColor Yellow
        Write-Host ""
        
        # Delegated Permissions (for SSO)
        Write-Host "  Delegated Permissions (SSO):" -ForegroundColor Cyan
        $userReadPermission = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"
        Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadPermission -PermissionType "Scope" -PermissionName "User.Read (Delegated)"
        
        $userReadBasicAll = "b340eb25-3456-403f-be2f-af7a0d370277"
        Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadBasicAll -PermissionType "Scope" -PermissionName "User.ReadBasic.All (Delegated)"
        
        Write-Host ""
        
        # Application Permissions (for SCIM sync)
        Write-Host "  Application Permissions (SCIM Sync):" -ForegroundColor Cyan
        $groupReadAll = "5b567255-7703-4780-807c-7be8301ae99b"
        Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $groupReadAll -PermissionType "Role" -PermissionName "Group.Read.All (Application)"
        
        $groupMemberReadAll = "98830695-27a2-44f7-8c18-0c3ebc9698f6"
        Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $groupMemberReadAll -PermissionType "Role" -PermissionName "GroupMember.Read.All (Application)"
        
        $userReadAll = "df021288-bdef-4463-88db-98f22de89214"
        Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadAll -PermissionType "Role" -PermissionName "User.Read.All (Application)"
        
        $userReadWriteAll = "741f803b-c850-494e-b5df-cde7c675a1ca"
        Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadWriteAll -PermissionType "Role" -PermissionName "User.ReadWrite.All (Application)"
        
        Write-Host ""
        Write-Host "⚠️  IMPORTANT: Admin consent is required for application permissions!" -ForegroundColor Yellow
        Write-Host "   Run: az ad app permission admin-consent --id $appId" -ForegroundColor Cyan
        Write-Host ""
        
        $grantConsent = Read-Host "Grant admin consent now? (Y/n)"
        if ($grantConsent -ne 'n' -and $grantConsent -ne 'N') {
            Write-Host "Granting admin consent..." -ForegroundColor Yellow
            az ad app permission admin-consent --id $appId
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Admin consent granted successfully" -ForegroundColor Green
            } else {
                Write-Host "Failed to grant admin consent. You may need to do this manually in Azure Portal." -ForegroundColor Red
            }
        }
    }
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
    # Configure API Permissions (Idempotent)
    # =============================================================================
    
    Write-Host "Configuring API permissions (idempotent)..." -ForegroundColor Yellow
    
    # Microsoft Graph Resource ID
    $graphResourceId = "00000003-0000-0000-c000-000000000000"
    
    # -----------------------------------------------------------------------------
    # Delegated Permissions (for SSO login)
    # -----------------------------------------------------------------------------
    Write-Host "  Delegated Permissions (SSO):" -ForegroundColor Cyan
    
    # User.Read (delegated) - Sign in and read user profile
    $userReadPermission = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"
    Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadPermission -PermissionType "Scope" -PermissionName "User.Read (Delegated)"
    
    # User.ReadBasic.All (delegated) - Read all users' basic profiles
    $userReadBasicAll = "b340eb25-3456-403f-be2f-af7a0d370277"
    Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadBasicAll -PermissionType "Scope" -PermissionName "User.ReadBasic.All (Delegated)"
    
    Write-Host ""
    
    # -----------------------------------------------------------------------------
    # Application Permissions (for SCIM sync - server-to-server)
    # -----------------------------------------------------------------------------
    Write-Host "  Application Permissions (SCIM Sync):" -ForegroundColor Cyan
    
    # Group.Read.All (Application) - Read all groups
    $groupReadAll = "5b567255-7703-4780-807c-7be8301ae99b"
    Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $groupReadAll -PermissionType "Role" -PermissionName "Group.Read.All (Application)"
    
    # GroupMember.Read.All (Application) - Read all group memberships
    $groupMemberReadAll = "98830695-27a2-44f7-8c18-0c3ebc9698f6"
    Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $groupMemberReadAll -PermissionType "Role" -PermissionName "GroupMember.Read.All (Application)"
    
    # User.Read.All (Application) - Read all users' full profiles
    $userReadAll = "df021288-bdef-4463-88db-98f22de89214"
    Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadAll -PermissionType "Role" -PermissionName "User.Read.All (Application)"
    
    # User.ReadWrite.All (Application) - For bidirectional sync (write back to Entra)
    $userReadWriteAll = "741f803b-c850-494e-b5df-cde7c675a1ca"
    Add-PermissionIfMissing -AppId $appId -ResourceId $graphResourceId -PermissionId $userReadWriteAll -PermissionType "Role" -PermissionName "User.ReadWrite.All (Application)"
    
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Admin consent is required for application permissions!" -ForegroundColor Yellow
    Write-Host "   Run the following command after script completes:" -ForegroundColor Yellow
    Write-Host "   az ad app permission admin-consent --id $appId" -ForegroundColor Cyan
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

Write-Host "API Permissions Configured:" -ForegroundColor Cyan
Write-Host "  Delegated (SSO):" -ForegroundColor Gray
Write-Host "    - User.Read              (Sign in and read user profile)" -ForegroundColor Gray
Write-Host "    - User.ReadBasic.All     (Read basic profiles)" -ForegroundColor Gray
Write-Host "  Application (SCIM Sync):" -ForegroundColor Yellow
Write-Host "    - Group.Read.All         (Read all groups)" -ForegroundColor Gray
Write-Host "    - GroupMember.Read.All   (Read group memberships)" -ForegroundColor Gray
Write-Host "    - User.Read.All          (Read all user profiles)" -ForegroundColor Gray
Write-Host "    - User.ReadWrite.All     (Bidirectional sync - write back)" -ForegroundColor Gray
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Copy the environment variables above to your .env.local file" -ForegroundColor Gray
Write-Host "  2. Grant admin consent for API permissions:" -ForegroundColor Yellow
Write-Host "     az ad app permission admin-consent --id $appId" -ForegroundColor Cyan
Write-Host "     OR via Azure Portal:" -ForegroundColor Gray
Write-Host "     https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$appId" -ForegroundColor Gray
Write-Host "  3. Start the application with HTTPS: docker-compose -f docker-compose.dev.yml up" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Admin consent is REQUIRED for SCIM sync to work!" -ForegroundColor Red
Write-Host ""
