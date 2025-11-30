<#
    .SYNOPSIS
    Configure GitHub OIDC authentication for Azure deployments.

    .DESCRIPTION
    Creates an Azure AD App Registration with federated credentials for GitHub Actions,
    assigns necessary RBAC roles, and outputs the secrets needed for GitHub.

    .PARAMETER GitHubOrg
    Required. GitHub organization or username.

    .PARAMETER GitHubRepo
    Required. GitHub repository name.

    .PARAMETER AppName
    Optional. Application name prefix. Default: idaraos

    .PARAMETER EnvironmentName
    Optional. Environment to configure Key Vault access for. Default: dev

    .PARAMETER Location
    Optional. Azure location code. Default: uks

    .PARAMETER Sequence
    Optional. Resource sequence number. Default: 001

    .PARAMETER SkipRoleAssignments
    Optional switch. Skip RBAC role assignments (useful if you lack permissions).

    .EXAMPLE
    ./setup-github-oidc.ps1 -GitHubOrg "myorg" -GitHubRepo "IdaraOS"

    .EXAMPLE
    ./setup-github-oidc.ps1 -GitHubOrg "myuser" -GitHubRepo "IdaraOS" -AppName "idaraos" -EnvironmentName "dev"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubOrg,

    [Parameter(Mandatory = $true)]
    [string]$GitHubRepo,

    [Parameter(Mandatory = $false)]
    [string]$AppName = "idaraos",

    [Parameter(Mandatory = $false)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$EnvironmentName = "dev",

    [Parameter(Mandatory = $false)]
    [string]$Location = "uks",

    [Parameter(Mandatory = $false)]
    [string]$Sequence = "001",

    [Parameter(Mandatory = $false)]
    [switch]$SkipRoleAssignments
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Helper Functions
# =============================================================================

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

# =============================================================================
# Build Resource Names
# =============================================================================

$appDisplayName = "$AppName-github-deploy"
$sharedResourceGroupName = "rg-$AppName-shared"
$resourceGroupName = "rg-$AppName-$EnvironmentName-$Location-$Sequence"
$acrName = "cr$AppName"
$keyVaultName = "kv-$AppName-$EnvironmentName-$Sequence"

# =============================================================================
# Verify Azure Login
# =============================================================================

Write-Step "Verifying Azure Login"

$account = az account show 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
if (-not $account) {
    Write-Host "Not logged in to Azure. Please run 'az login' first." -ForegroundColor Red
    exit 1
}

$subscriptionId = $account.id
$tenantId = $account.tenantId

Write-Success "Logged in as: $($account.user.name)"
Write-Info "Subscription: $($account.name) ($subscriptionId)"
Write-Info "Tenant: $tenantId"

# =============================================================================
# Create or Get App Registration
# =============================================================================

Write-Step "App Registration"

# Check if app already exists
$existingApp = az ad app list --display-name $appDisplayName --query "[0].appId" -o tsv 2>$null

if ($existingApp) {
    $appId = $existingApp
    Write-Info "App registration already exists: $appId"
}
else {
    Write-Info "Creating app registration: $appDisplayName"
    $appId = az ad app create --display-name $appDisplayName --query appId -o tsv
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create app registration" -ForegroundColor Red
        exit 1
    }
    Write-Success "Created app registration: $appId"
}

# =============================================================================
# Create Service Principal
# =============================================================================

Write-Step "Service Principal"

$existingSp = az ad sp show --id $appId 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Info "Creating service principal..."
    az ad sp create --id $appId --output none
    Write-Success "Service principal created"
}
else {
    Write-Info "Service principal already exists"
}

# =============================================================================
# Configure Federated Credentials
# =============================================================================

Write-Step "Federated Credentials for GitHub Actions"

$credentials = @(
    @{
        Name = "github-main"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:ref:refs/heads/main"
        Description = "GitHub Actions - main branch"
    },
    @{
        Name = "github-env-dev"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:environment:dev"
        Description = "GitHub Actions - dev environment"
    },
    @{
        Name = "github-env-staging"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:environment:staging"
        Description = "GitHub Actions - staging environment"
    },
    @{
        Name = "github-env-production"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:environment:production"
        Description = "GitHub Actions - production environment"
    },
    @{
        Name = "github-pull-request"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:pull_request"
        Description = "GitHub Actions - pull requests"
    }
)

# Get all existing federated credentials for this app
Write-Info "Checking existing federated credentials..."
$existingCredsJson = az ad app federated-credential list --id $appId 2>$null
$existingCreds = @()
if ($existingCredsJson) {
    try {
        $existingCreds = $existingCredsJson | ConvertFrom-Json
    }
    catch {
        $existingCreds = @()
    }
}

# Create a temp file for JSON parameters (Azure CLI requires file-based JSON for complex params)
$tempJsonFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.json'

foreach ($cred in $credentials) {
    $credName = $cred.Name
    $credSubject = $cred.Subject
    $credDescription = $cred.Description
    
    # Find existing credential by name
    $existingCred = $existingCreds | Where-Object { $_.name -eq $credName }
    
    if ($existingCred) {
        # Credential exists - check if subject matches
        if ($existingCred.subject -eq $credSubject) {
            Write-Info "  ✓ $credName (already configured correctly)"
        }
        else {
            # Subject doesn't match - need to update
            Write-Info "  Updating $credName (subject changed)..."
            
            # Write JSON to temp file
            $credParams = @{
                name = $credName
                issuer = "https://token.actions.githubusercontent.com"
                subject = $credSubject
                description = $credDescription
                audiences = @("api://AzureADTokenExchange")
            }
            $credParams | ConvertTo-Json -Depth 10 | Set-Content -Path $tempJsonFile -Encoding UTF8
            
            # Delete and recreate (az ad app federated-credential doesn't support update well)
            az ad app federated-credential delete --id $appId --federated-credential-id $existingCred.id --output none 2>$null
            $result = az ad app federated-credential create --id $appId --parameters "@$tempJsonFile" 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Updated: $credName"
            }
            else {
                Write-Warning "Failed to update: $credName"
                Write-Info "    Error: $result"
            }
        }
    }
    else {
        # Credential doesn't exist - create it
        Write-Info "  Creating $credName..."
        
        # Write JSON to temp file
        $credParams = @{
            name = $credName
            issuer = "https://token.actions.githubusercontent.com"
            subject = $credSubject
            description = $credDescription
            audiences = @("api://AzureADTokenExchange")
        }
        $credParams | ConvertTo-Json -Depth 10 | Set-Content -Path $tempJsonFile -Encoding UTF8
        
        $result = az ad app federated-credential create --id $appId --parameters "@$tempJsonFile" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Created: $credName"
        }
        else {
            Write-Warning "Failed to create: $credName"
            Write-Info "    Error: $result"
        }
    }
}

# Clean up temp file
if (Test-Path $tempJsonFile) {
    Remove-Item $tempJsonFile -Force
}

# =============================================================================
# Assign RBAC Roles
# =============================================================================

if (-not $SkipRoleAssignments) {
    Write-Step "RBAC Role Assignments"
    
    $roles = @(
        @{
            Role = "Contributor"
            Scope = "/subscriptions/$subscriptionId"
            Description = "Contributor on subscription"
            Required = $true
        },
        @{
            Role = "AcrPush"
            Scope = "/subscriptions/$subscriptionId/resourceGroups/$sharedResourceGroupName/providers/Microsoft.ContainerRegistry/registries/$acrName"
            Description = "AcrPush on Container Registry"
            Required = $false
        },
        @{
            Role = "Key Vault Secrets User"
            Scope = "/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName/providers/Microsoft.KeyVault/vaults/$keyVaultName"
            Description = "Key Vault Secrets User on Key Vault"
            Required = $false
        }
    )
    
    # Get all existing role assignments for this service principal
    Write-Info "Checking existing role assignments..."
    $existingAssignmentsJson = az role assignment list --assignee $appId --all 2>$null
    $existingAssignments = @()
    if ($existingAssignmentsJson) {
        try {
            $existingAssignments = $existingAssignmentsJson | ConvertFrom-Json
        }
        catch {
            $existingAssignments = @()
        }
    }
    
    foreach ($role in $roles) {
        $roleName = $role.Role
        $roleScope = $role.Scope
        $roleDesc = $role.Description
        
        # Check if this specific role+scope combination exists
        $existingAssignment = $existingAssignments | Where-Object { 
            $_.roleDefinitionName -eq $roleName -and $_.scope -eq $roleScope 
        }
        
        if ($existingAssignment) {
            Write-Info "  ✓ $roleDesc (already assigned)"
            continue
        }
        
        # Check if the resource exists before trying to assign (for non-subscription scopes)
        if ($roleScope -ne "/subscriptions/$subscriptionId") {
            $resourceExists = az resource show --ids $roleScope 2>$null
            if ($LASTEXITCODE -ne 0) {
                if ($role.Required) {
                    Write-Warning "Resource not found: $roleScope"
                }
                else {
                    Write-Info "  ⏭ Skipping $roleDesc (resource not yet created)"
                }
                continue
            }
        }
        
        Write-Info "  Creating: $roleDesc..."
        az role assignment create `
            --assignee $appId `
            --role $roleName `
            --scope $roleScope `
            --output none 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$roleDesc"
        }
        else {
            Write-Warning "Failed to assign: $roleName"
        }
    }
}
else {
    Write-Step "Skipping RBAC Role Assignments"
    Write-Info "You will need to manually assign these roles:"
    Write-Info "  - Contributor on subscription"
    Write-Info "  - AcrPush on Container Registry"
    Write-Info "  - Key Vault Secrets User on Key Vault"
}

# =============================================================================
# Summary
# =============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "GitHub OIDC Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Add these secrets to your GitHub repository:" -ForegroundColor Cyan
Write-Host "  Settings → Secrets and variables → Actions → New repository secret" -ForegroundColor Gray
Write-Host ""
Write-Host "┌─────────────────────────┬──────────────────────────────────────────┐" -ForegroundColor White
Write-Host "│ Secret Name             │ Value                                    │" -ForegroundColor White
Write-Host "├─────────────────────────┼──────────────────────────────────────────┤" -ForegroundColor White
Write-Host "│ AZURE_CLIENT_ID         │ $appId │" -ForegroundColor Yellow
Write-Host "│ AZURE_TENANT_ID         │ $tenantId │" -ForegroundColor Yellow
Write-Host "│ AZURE_SUBSCRIPTION_ID   │ $subscriptionId │" -ForegroundColor Yellow
Write-Host "│ ACR_NAME                │ $acrName                                 │" -ForegroundColor Yellow
Write-Host "└─────────────────────────┴──────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "Create these GitHub Environments:" -ForegroundColor Cyan
Write-Host "  Settings → Environments → New environment" -ForegroundColor Gray
Write-Host ""
Write-Host "  1. dev         (no protection rules)" -ForegroundColor Gray
Write-Host "  2. staging     (optional: add reviewers)" -ForegroundColor Gray
Write-Host "  3. production  (required: add reviewers, restrict to main branch)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Add the secrets above to GitHub" -ForegroundColor Gray
Write-Host "  2. Create the GitHub environments" -ForegroundColor Gray
Write-Host "  3. Push to main branch to trigger deployment" -ForegroundColor Gray
Write-Host "  4. Or manually run 'Deploy to Azure' workflow from Actions tab" -ForegroundColor Gray
Write-Host ""

# Output for easy copying
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Copy-Paste Values:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AZURE_CLIENT_ID=$appId"
Write-Host "AZURE_TENANT_ID=$tenantId"
Write-Host "AZURE_SUBSCRIPTION_ID=$subscriptionId"
Write-Host "ACR_NAME=$acrName"
Write-Host ""
