<#
    .SYNOPSIS
    Initialize IdaraOS infrastructure on Azure.

    .DESCRIPTION
    Creates all required Azure resources for IdaraOS deployment:
    - Shared Container Registry (in shared resource group)
    - Environment-specific resources (PostgreSQL, Container Apps, Key Vault)
    - Optional PIM RBAC groups for Just-In-Time access

    .PARAMETER SubscriptionName
    Optional. The Azure subscription name for environment resources.
    Defaults to sub_{env}_idaraos pattern.

    .PARAMETER EnvironmentName
    Required. Environment name (dev, staging, prod).

    .PARAMETER Location
    Required. Azure location code (uks, eus, weu, etc.).

    .PARAMETER Sequence
    Required. Sequence number for resource naming (001, 002 for DR).

    .PARAMETER Owner
    Required. Owner email for resource tags.

    .PARAMETER SharedSubscriptionName
    Optional. Subscription for shared resources. Default: sub_shared_idaraos

    .PARAMETER SharedSubscriptionId
    Optional. Subscription ID for shared resources (alternative to name).

    .PARAMETER EnablePim
    Optional switch. Creates PIM RBAC groups for Just-In-Time access.

    .PARAMETER ValidateOnly
    Optional switch. Dry-run mode - validates without creating resources.

    .PARAMETER AppName
    Optional. Application name prefix for resources. Default: idaraos

    .EXAMPLE
    az login
    ./init-infrastructure.ps1 `
        -EnvironmentName "dev" `
        -Location "uks" `
        -Sequence "001" `
        -Owner "admin@company.com"

    .EXAMPLE
    # With PIM enabled
    ./init-infrastructure.ps1 `
        -EnvironmentName "prod" `
        -Location "uks" `
        -Sequence "001" `
        -Owner "admin@company.com" `
        -EnablePim
#>
[CmdletBinding()]
Param(
    [Parameter(Mandatory = $false)]
    [string]$SubscriptionName,

    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$EnvironmentName,

    [Parameter(Mandatory = $true)]
    [string]$Location,

    [Parameter(Mandatory = $true)]
    [string]$Sequence,

    [Parameter(Mandatory = $true)]
    [string]$Owner,

    [Parameter(Mandatory = $false)]
    [string]$SharedSubscriptionName = "sub_shared_idaraos",

    [Parameter(Mandatory = $false)]
    [string]$SharedSubscriptionId,

    [Parameter(Mandatory = $false)]
    [switch]$EnablePim,

    [Parameter(Mandatory = $false)]
    [switch]$ValidateOnly,

    [Parameter(Mandatory = $false)]
    [string]$AppName
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Helper Functions
# =============================================================================

function Get-AzureLocationName {
    param([string]$LocationCode)
    
    $locationMap = @{
        "uks"  = "uksouth"
        "ukn"  = "uknorth"
        "eus"  = "eastus"
        "eus2" = "eastus2"
        "wus"  = "westus"
        "wus2" = "westus2"
        "weu"  = "westeurope"
        "neu"  = "northeurope"
        "sea"  = "southeastasia"
        "aue"  = "australiaeast"
        "jpe"  = "japaneast"
        "cac"  = "canadacentral"
    }
    
    $fullLocation = $locationMap[$LocationCode.ToLower()]
    if ([string]::IsNullOrWhiteSpace($fullLocation)) {
        Write-Host "  Location code '$LocationCode' not in map - using as-is" -ForegroundColor Yellow
        return $LocationCode
    }
    return $fullLocation
}

function GenerateSecurePassword {
    param([int]$Length = 32)
    
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    $password = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $password
}

function Test-ResourceNameValid {
    param(
        [string]$Name,
        [string]$ResourceType
    )
    
    switch ($ResourceType) {
        "acr" {
            # ACR: 5-50 chars, alphanumeric only
            if ($Name -notmatch '^[a-zA-Z0-9]{5,50}$') {
                return @{ Valid = $false; Message = "ACR name must be 5-50 alphanumeric characters" }
            }
        }
        "keyvault" {
            # Key Vault: 3-24 chars, alphanumeric + hyphens, start with letter
            if ($Name -notmatch '^[a-zA-Z][a-zA-Z0-9-]{2,23}$') {
                return @{ Valid = $false; Message = "Key Vault name must be 3-24 chars, start with letter, alphanumeric + hyphens" }
            }
        }
        "postgresql" {
            # PostgreSQL: 3-63 chars, lowercase + hyphens
            if ($Name -notmatch '^[a-z][a-z0-9-]{2,62}$') {
                return @{ Valid = $false; Message = "PostgreSQL name must be 3-63 chars, lowercase + hyphens, start with letter" }
            }
        }
    }
    return @{ Valid = $true; Message = "" }
}

# =============================================================================
# Interactive Naming Configuration
# =============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resource Naming Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "The following prefix will be used for Azure resources." -ForegroundColor Gray
Write-Host "Press Enter to accept default or type a new value." -ForegroundColor Gray
Write-Host ""

# Prompt for application name
$defaultAppName = "idaraos"
if ([string]::IsNullOrWhiteSpace($AppName)) {
    $inputAppName = Read-Host "Application Name [$defaultAppName]"
    if ([string]::IsNullOrWhiteSpace($inputAppName)) {
        $AppName = $defaultAppName
    }
    else {
        $AppName = $inputAppName.ToLower() -replace '[^a-z0-9]', ''
    }
}

Write-Host ""
Write-Host "Resource Naming Preview:" -ForegroundColor Cyan
Write-Host "  Shared RG:           rg-$AppName-shared" -ForegroundColor Gray
Write-Host "  Environment RG:      rg-$AppName-$EnvironmentName-$Location-$Sequence" -ForegroundColor Gray
Write-Host "  Container Registry:  cr$AppName" -ForegroundColor Gray
Write-Host "  Container App Env:   cae-$AppName-$EnvironmentName" -ForegroundColor Gray
Write-Host "  Container App:       $AppName-$EnvironmentName" -ForegroundColor Gray
Write-Host "  PostgreSQL:          psql-$AppName-$EnvironmentName-$Location-$Sequence" -ForegroundColor Gray
Write-Host "  Key Vault:           kv-$AppName-$EnvironmentName-$Sequence" -ForegroundColor Gray
Write-Host "  Log Analytics:       log-$AppName-$EnvironmentName" -ForegroundColor Gray
Write-Host ""

$confirmNaming = Read-Host "Proceed with this naming? (Y/n)"
if ($confirmNaming -eq 'n' -or $confirmNaming -eq 'N') {
    Write-Host "Aborted by user." -ForegroundColor Yellow
    exit 0
}

# =============================================================================
# Build Resource Names
# =============================================================================

$sharedResourceGroupName = "rg-$AppName-shared"
$resourceGroupName = "rg-$AppName-$EnvironmentName-$Location-$Sequence"
$acrName = "cr$AppName"
$containerAppEnvName = "cae-$AppName-$EnvironmentName"
$containerAppName = "$AppName-$EnvironmentName"
$postgresqlName = "psql-$AppName-$EnvironmentName-$Location-$Sequence"
$keyVaultName = "kv-$AppName-$EnvironmentName-$Sequence"
$logAnalyticsName = "log-$AppName-$EnvironmentName"
$azureLocationName = Get-AzureLocationName -LocationCode $Location

# Validate resource names
$acrValidation = Test-ResourceNameValid -Name $acrName -ResourceType "acr"
if (-not $acrValidation.Valid) {
    Write-Host "Invalid ACR name: $($acrValidation.Message)" -ForegroundColor Red
    exit 1
}

$kvValidation = Test-ResourceNameValid -Name $keyVaultName -ResourceType "keyvault"
if (-not $kvValidation.Valid) {
    Write-Host "Invalid Key Vault name: $($kvValidation.Message)" -ForegroundColor Red
    exit 1
}

$psqlValidation = Test-ResourceNameValid -Name $postgresqlName -ResourceType "postgresql"
if (-not $psqlValidation.Valid) {
    Write-Host "Invalid PostgreSQL name: $($psqlValidation.Message)" -ForegroundColor Red
    exit 1
}

# Tags
$tagApplication = $AppName
$tagEnvironment = $EnvironmentName.ToUpper()
$tagCreatedOn = (Get-Date -UFormat "%F")

# =============================================================================
# Determine Subscription
# =============================================================================

$subscriptionNameToUse = $SubscriptionName
if ([string]::IsNullOrWhiteSpace($subscriptionNameToUse)) {
    $subscriptionNameToUse = "sub_$($EnvironmentName)_$AppName"
    Write-Host "Using environment-based subscription: $subscriptionNameToUse" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setting Azure Subscription" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Subscription: $subscriptionNameToUse" -ForegroundColor Yellow
Write-Host ""

# Try to set subscription
$setSubResult = az account set --subscription $subscriptionNameToUse 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not set subscription '$subscriptionNameToUse'" -ForegroundColor Yellow
    Write-Host "Listing available subscriptions..." -ForegroundColor Gray
    az account list --output table
    Write-Host ""
    $manualSub = Read-Host "Enter subscription name or ID to use"
    az account set --subscription $manualSub
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set subscription: $manualSub"
    }
}

$subscriptionInfo = az account show | ConvertFrom-Json
$subscriptionId = $subscriptionInfo.id
$tenantId = $subscriptionInfo.tenantId

Write-Host "Subscription set successfully" -ForegroundColor Green
Write-Host "  Name: $($subscriptionInfo.name)" -ForegroundColor Gray
Write-Host "  ID: $subscriptionId" -ForegroundColor Gray
Write-Host "  Tenant: $tenantId" -ForegroundColor Gray
Write-Host ""

if ($ValidateOnly) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "VALIDATION MODE - No resources will be created" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
}

# =============================================================================
# Register Resource Providers
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Registering Resource Providers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$providers = @(
    "Microsoft.ContainerRegistry",
    "Microsoft.App",
    "Microsoft.OperationalInsights",
    "Microsoft.DBforPostgreSQL",
    "Microsoft.KeyVault",
    "Microsoft.ManagedIdentity"
)

foreach ($provider in $providers) {
    Write-Host "  Checking $provider..." -ForegroundColor Gray
    $status = az provider show --namespace $provider --query "registrationState" -o tsv 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $status -eq "Registered") {
        Write-Host "    Already registered" -ForegroundColor Green
    }
    else {
        if (-not $ValidateOnly) {
            Write-Host "    Registering..." -ForegroundColor Yellow
            az provider register --namespace $provider --wait 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    Registered" -ForegroundColor Green
            }
            else {
                Write-Host "    Failed to register (may require admin)" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "    Would register (validation mode)" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# =============================================================================
# Create/Verify Shared Container Registry
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Shared Container Registry Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Determine shared subscription
$sharedSubId = $null
if (-not [string]::IsNullOrWhiteSpace($SharedSubscriptionId)) {
    $sharedSubId = $SharedSubscriptionId
    Write-Host "Using provided shared subscription ID: $sharedSubId" -ForegroundColor Gray
}
else {
    # Try to find shared subscription by name
    $allSubs = az account list --output json 2>&1 | ConvertFrom-Json
    $sharedSub = $allSubs | Where-Object { $_.name -eq $SharedSubscriptionName }
    
    if ($sharedSub) {
        $sharedSubId = $sharedSub.id
        Write-Host "Found shared subscription: $SharedSubscriptionName ($sharedSubId)" -ForegroundColor Green
    }
    else {
        # Use current subscription for shared resources
        Write-Host "Shared subscription '$SharedSubscriptionName' not found" -ForegroundColor Yellow
        Write-Host "Using current subscription for shared resources" -ForegroundColor Yellow
        $sharedSubId = $subscriptionId
    }
}

# Store current subscription
$currentSubId = $subscriptionId

# Switch to shared subscription if different
if ($sharedSubId -ne $currentSubId) {
    Write-Host "Switching to shared subscription..." -ForegroundColor Gray
    az account set --subscription $sharedSubId 2>&1 | Out-Null
}

# Create shared resource group
Write-Host "Checking shared resource group: $sharedResourceGroupName" -ForegroundColor Gray
$sharedRgExists = az group exists --name $sharedResourceGroupName 2>&1

if ($sharedRgExists -eq "false") {
    if (-not $ValidateOnly) {
        Write-Host "  Creating shared resource group..." -ForegroundColor Yellow
        az group create `
            --name $sharedResourceGroupName `
            --location $azureLocationName `
            --tags Owner=$Owner Application=$tagApplication Environment=Shared CreatedOn=$tagCreatedOn `
            --output none
        Write-Host "  Created" -ForegroundColor Green
    }
    else {
        Write-Host "  Would create (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  Already exists" -ForegroundColor Green
}

# Create Container Registry
Write-Host "Checking Container Registry: $acrName" -ForegroundColor Gray
$acrExists = az acr show --resource-group $sharedResourceGroupName --name $acrName 2>&1

if ($LASTEXITCODE -ne 0) {
    if (-not $ValidateOnly) {
        Write-Host "  Creating Container Registry..." -ForegroundColor Yellow
        az acr create `
            --resource-group $sharedResourceGroupName `
            --name $acrName `
            --sku Basic `
            --admin-enabled true `
            --location $azureLocationName `
            --output none
        Write-Host "  Created" -ForegroundColor Green
    }
    else {
        Write-Host "  Would create (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  Already exists" -ForegroundColor Green
}

# Switch back to environment subscription
if ($sharedSubId -ne $currentSubId) {
    Write-Host "Switching back to environment subscription..." -ForegroundColor Gray
    az account set --subscription $currentSubId 2>&1 | Out-Null
}

Write-Host ""

# =============================================================================
# Create Environment Resource Group
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment Resource Group" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resource Group: $resourceGroupName" -ForegroundColor Yellow
Write-Host "Location: $azureLocationName" -ForegroundColor Yellow
Write-Host ""

$rgExists = az group exists --name $resourceGroupName 2>&1

if ($rgExists -eq "false") {
    if (-not $ValidateOnly) {
        Write-Host "Creating resource group..." -ForegroundColor Yellow
        az group create `
            --name $resourceGroupName `
            --location $azureLocationName `
            --tags Owner=$Owner Application=$tagApplication Environment=$tagEnvironment CreatedOn=$tagCreatedOn `
            --output none
        Write-Host "Resource group created" -ForegroundColor Green
    }
    else {
        Write-Host "Would create resource group (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "Resource group already exists" -ForegroundColor Green
}
Write-Host ""

# =============================================================================
# Create Log Analytics Workspace
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Log Analytics Workspace" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$logExists = az monitor log-analytics workspace show `
    --resource-group $resourceGroupName `
    --workspace-name $logAnalyticsName 2>&1

if ($LASTEXITCODE -ne 0) {
    if (-not $ValidateOnly) {
        Write-Host "Creating Log Analytics workspace: $logAnalyticsName" -ForegroundColor Yellow
        az monitor log-analytics workspace create `
            --resource-group $resourceGroupName `
            --workspace-name $logAnalyticsName `
            --location $azureLocationName `
            --output none
        Write-Host "Log Analytics workspace created" -ForegroundColor Green
    }
    else {
        Write-Host "Would create Log Analytics workspace (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "Log Analytics workspace already exists" -ForegroundColor Green
}

# Get workspace ID and key
$workspaceId = $null
$workspaceKey = $null
if (-not $ValidateOnly) {
    $workspace = az monitor log-analytics workspace show `
        --resource-group $resourceGroupName `
        --workspace-name $logAnalyticsName | ConvertFrom-Json
    $workspaceId = $workspace.customerId
    
    $keys = az monitor log-analytics workspace get-shared-keys `
        --resource-group $resourceGroupName `
        --workspace-name $logAnalyticsName | ConvertFrom-Json
    $workspaceKey = $keys.primarySharedKey
}
Write-Host ""

# =============================================================================
# Create PostgreSQL Flexible Server
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Flexible Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$pgExists = az postgres flexible-server show `
    --resource-group $resourceGroupName `
    --name $postgresqlName 2>&1

$pgPassword = GenerateSecurePassword -Length 32

if ($LASTEXITCODE -ne 0) {
    if (-not $ValidateOnly) {
        Write-Host "Creating PostgreSQL server: $postgresqlName" -ForegroundColor Yellow
        Write-Host "  SKU: Standard_B1ms (burstable)" -ForegroundColor Gray
        Write-Host "  Storage: 32GB" -ForegroundColor Gray
        
        # For prod, use private access; for dev/staging, allow public
        $publicAccess = if ($EnvironmentName -eq "prod") { "Disabled" } else { "Enabled" }
        
        az postgres flexible-server create `
            --resource-group $resourceGroupName `
            --name $postgresqlName `
            --location $azureLocationName `
            --admin-user pgadmin `
            --admin-password $pgPassword `
            --sku-name Standard_B1ms `
            --tier Burstable `
            --storage-size 32 `
            --version 16 `
            --public-access $publicAccess `
            --tags Owner=$Owner Application=$tagApplication Environment=$tagEnvironment `
            --output none
        
        Write-Host "PostgreSQL server created" -ForegroundColor Green
        
        # Create database
        Write-Host "Creating database: $AppName" -ForegroundColor Yellow
        az postgres flexible-server db create `
            --resource-group $resourceGroupName `
            --server-name $postgresqlName `
            --database-name $AppName `
            --output none
        Write-Host "Database created" -ForegroundColor Green
        
        # Allow Azure services (for Container Apps)
        if ($publicAccess -eq "Enabled") {
            Write-Host "Configuring firewall for Azure services..." -ForegroundColor Yellow
            az postgres flexible-server firewall-rule create `
                --resource-group $resourceGroupName `
                --name $postgresqlName `
                --rule-name AllowAzureServices `
                --start-ip-address 0.0.0.0 `
                --end-ip-address 0.0.0.0 `
                --output none
        }
    }
    else {
        Write-Host "Would create PostgreSQL server (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "PostgreSQL server already exists" -ForegroundColor Green
}
Write-Host ""

# =============================================================================
# Create Key Vault
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Key Vault" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$kvExists = az keyvault show --name $keyVaultName 2>&1

if ($LASTEXITCODE -ne 0) {
    if (-not $ValidateOnly) {
        Write-Host "Creating Key Vault: $keyVaultName" -ForegroundColor Yellow
        az keyvault create `
            --resource-group $resourceGroupName `
            --name $keyVaultName `
            --location $azureLocationName `
            --enable-rbac-authorization true `
            --tags Owner=$Owner Application=$tagApplication Environment=$tagEnvironment `
            --output none
        Write-Host "Key Vault created" -ForegroundColor Green
        
        # Store secrets
        Write-Host "Storing secrets in Key Vault..." -ForegroundColor Yellow
        
        $jwtSecret = GenerateSecurePassword -Length 64
        $encryptionKey = GenerateSecurePassword -Length 32
        
        az keyvault secret set --vault-name $keyVaultName --name "jwt-secret" --value $jwtSecret --output none
        az keyvault secret set --vault-name $keyVaultName --name "encryption-key" --value $encryptionKey --output none
        az keyvault secret set --vault-name $keyVaultName --name "pg-password" --value $pgPassword --output none
        
        Write-Host "Secrets stored" -ForegroundColor Green
    }
    else {
        Write-Host "Would create Key Vault (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "Key Vault already exists" -ForegroundColor Green
}
Write-Host ""

# =============================================================================
# Create Container Apps Environment
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Container Apps Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$caeExists = az containerapp env show `
    --resource-group $resourceGroupName `
    --name $containerAppEnvName 2>&1

if ($LASTEXITCODE -ne 0) {
    if (-not $ValidateOnly) {
        Write-Host "Creating Container Apps Environment: $containerAppEnvName" -ForegroundColor Yellow
        
        az containerapp env create `
            --resource-group $resourceGroupName `
            --name $containerAppEnvName `
            --location $azureLocationName `
            --logs-workspace-id $workspaceId `
            --logs-workspace-key $workspaceKey `
            --output none
        
        Write-Host "Container Apps Environment created" -ForegroundColor Green
    }
    else {
        Write-Host "Would create Container Apps Environment (validation mode)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "Container Apps Environment already exists" -ForegroundColor Green
}
Write-Host ""

# =============================================================================
# Create PIM RBAC Groups (Optional)
# =============================================================================

if ($EnablePim) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "PIM RBAC Groups" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $pimScript = Join-Path $PSScriptRoot "create-pim-rbac-groups.ps1"
    if (Test-Path $pimScript) {
        & $pimScript `
            -EnvironmentName $EnvironmentName `
            -SubscriptionId $subscriptionId `
            -AppName $AppName
    }
    else {
        Write-Host "PIM script not found at: $pimScript" -ForegroundColor Yellow
        Write-Host "Skipping PIM RBAC groups creation" -ForegroundColor Yellow
    }
    Write-Host ""
}

# =============================================================================
# Summary
# =============================================================================

Write-Host "========================================" -ForegroundColor Green
Write-Host "Infrastructure Setup Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Resources Created:" -ForegroundColor Cyan
Write-Host "  Shared Resource Group:    $sharedResourceGroupName" -ForegroundColor Gray
Write-Host "  Container Registry:       $acrName.azurecr.io" -ForegroundColor Gray
Write-Host "  Environment Resource Group: $resourceGroupName" -ForegroundColor Gray
Write-Host "  PostgreSQL Server:        $postgresqlName.postgres.database.azure.com" -ForegroundColor Gray
Write-Host "  Key Vault:                $keyVaultName.vault.azure.net" -ForegroundColor Gray
Write-Host "  Container Apps Env:       $containerAppEnvName" -ForegroundColor Gray
Write-Host "  Log Analytics:            $logAnalyticsName" -ForegroundColor Gray
Write-Host ""

if (-not $ValidateOnly) {
    # Build connection string
    $dbConnectionString = "postgresql://pgadmin:$pgPassword@$postgresqlName.postgres.database.azure.com:5432/$AppName?sslmode=require"
    
    Write-Host "Connection Information:" -ForegroundColor Cyan
    Write-Host "  DATABASE_URL: postgresql://pgadmin:<password>@$postgresqlName.postgres.database.azure.com:5432/$AppName?sslmode=require" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Secrets stored in Key Vault ($keyVaultName):" -ForegroundColor Cyan
    Write-Host "  - jwt-secret" -ForegroundColor Gray
    Write-Host "  - encryption-key" -ForegroundColor Gray
    Write-Host "  - pg-password" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Configure GitHub OIDC for deployment (see README)" -ForegroundColor Gray
Write-Host "  2. Run database migrations: pnpm db:migrate" -ForegroundColor Gray
Write-Host "  3. Deploy application using GitHub Actions" -ForegroundColor Gray
Write-Host ""
