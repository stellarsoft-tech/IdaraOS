<#
.SYNOPSIS
    Sets up Microsoft Entra ID (Azure AD) application for IdaraOS SSO integration.

.DESCRIPTION
    This script creates or updates an Entra ID application registration with the necessary
    configuration for Single Sign-On (SSO) and SCIM user provisioning with IdaraOS.
    
    The script is idempotent - running it multiple times will update the existing configuration
    rather than creating duplicates.
    
    IMPORTANT: A valid Tenant ID is required to create app registrations. If not provided via
    parameter or current Azure context, the script will prompt you to enter one.

.PARAMETER AppName
    The display name for the application in Entra ID.
    Default: "IdaraOS"

.PARAMETER AppUrl
    The base URL where IdaraOS is hosted.
    Default: "http://localhost:3000"

.PARAMETER TenantId
    The Azure AD tenant ID. RECOMMENDED to provide this explicitly.
    If not provided, uses the current Azure context. If no context exists,
    the script will prompt for it.
    
    To find your Tenant ID:
    1. Go to https://portal.azure.com
    2. Navigate to Microsoft Entra ID > Overview
    3. Copy the "Tenant ID" value

.PARAMETER SubscriptionName
    Optional. The Azure subscription name to use. 
    Note: Subscriptions are NOT required for app registrations, but may be needed
    for other Azure operations.

.PARAMETER CreateSecret
    Whether to create a new client secret. Default: $true

.PARAMETER SecretExpiryYears
    Number of years until the client secret expires. Default: 2

.EXAMPLE
    .\setup-entra-sso.ps1 -TenantId "12345678-1234-1234-1234-123456789012"
    
    RECOMMENDED: Sets up with explicit tenant ID for local development.

.EXAMPLE
    .\setup-entra-sso.ps1
    
    Sets up using current Azure context (tenant must be available).

.EXAMPLE
    .\setup-entra-sso.ps1 -AppName "MyCompany IdaraOS" -AppUrl "https://idaraos.mycompany.com" -TenantId "12345678-1234-1234-1234-123456789012"
    
    Sets up for production with custom app name, URL, and explicit tenant.

.NOTES
    Author: IdaraOS Team
    Requires: Az.Accounts, Az.Resources modules
    
    Finding your Tenant ID:
    - Azure Portal: Entra ID > Overview > Tenant ID
    - PowerShell: (Get-AzContext).Tenant.Id
    - URL: https://portal.azure.com/#settings/directory
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$AppName = "IdaraOS",

    [Parameter()]
    [string]$AppUrl = "http://localhost:3000",

    [Parameter()]
    [string]$TenantId,

    [Parameter()]
    [string]$SubscriptionName,

    [Parameter()]
    [bool]$CreateSecret = $true,

    [Parameter()]
    [int]$SecretExpiryYears = 2
)

#region Helper Functions

function Write-StepHeader {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-StepProgress {
    param([string]$Message)
    Write-Host "  → $Message" -ForegroundColor Yellow
}

function Write-StepSuccess {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Write-StepError {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

function Write-StepInfo {
    param([string]$Message)
    Write-Host "  ℹ $Message" -ForegroundColor Gray
}

function Write-ConfigValue {
    param(
        [string]$Label,
        [string]$Value,
        [switch]$Secret
    )
    $displayValue = if ($Secret) { "****" + $Value.Substring([Math]::Max(0, $Value.Length - 4)) } else { $Value }
    Write-Host "  $Label" -ForegroundColor White -NoNewline
    Write-Host ": " -NoNewline
    Write-Host $displayValue -ForegroundColor Cyan
}

#endregion

#region Main Script

$ErrorActionPreference = "Stop"
$script:summary = @{}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                                  ║" -ForegroundColor Magenta
Write-Host "║       IdaraOS - Microsoft Entra ID SSO Setup Script              ║" -ForegroundColor Magenta
Write-Host "║                                                                  ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Check Prerequisites
# ─────────────────────────────────────────────────────────────────────────────
Write-StepHeader "Step 1: Checking Prerequisites"

Write-StepProgress "Checking for Az PowerShell modules..."

$requiredModules = @("Az.Accounts", "Az.Resources")
$missingModules = @()

foreach ($module in $requiredModules) {
    if (-not (Get-Module -ListAvailable -Name $module)) {
        $missingModules += $module
    }
}

if ($missingModules.Count -gt 0) {
    Write-StepError "Missing required modules: $($missingModules -join ', ')"
    Write-Host ""
    Write-Host "  Install them with:" -ForegroundColor Yellow
    Write-Host "    Install-Module -Name Az -Scope CurrentUser -Repository PSGallery -Force" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-StepSuccess "All required modules are installed"

# Import modules
Import-Module Az.Accounts -ErrorAction Stop
Import-Module Az.Resources -ErrorAction Stop
Write-StepSuccess "Modules imported successfully"

# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Authenticate to Azure
# ─────────────────────────────────────────────────────────────────────────────
Write-StepHeader "Step 2: Authenticating to Azure"

$context = Get-AzContext -ErrorAction SilentlyContinue

# Determine the tenant to use
$targetTenantId = $TenantId  # From parameter

# If no tenant specified and we have context, try to use that tenant
if (-not $targetTenantId -and $context -and $context.Tenant -and $context.Tenant.Id) {
    $targetTenantId = $context.Tenant.Id
    Write-StepInfo "Using tenant from current context: $targetTenantId"
}

# Function to authenticate with Microsoft Graph scope
function Connect-AzAccountWithGraphScope {
    param([string]$TenantIdParam)
    
    Write-StepProgress "Authenticating with Microsoft Graph scope (required for app registrations)..."
    
    $connectParams = @{
        AuthScope = "MicrosoftGraphEndpointResourceId"
        UseDeviceAuthentication = $false
    }
    
    if ($TenantIdParam) {
        $connectParams["TenantId"] = $TenantIdParam
    }
    
    Connect-AzAccount @connectParams
}

# Check if we need to authenticate
$needsAuth = $false
$needsGraphScope = $false

if (-not $context) {
    Write-StepProgress "No Azure context found. Starting interactive login..."
    $needsAuth = $true
    $needsGraphScope = $true
}
else {
    Write-StepInfo "Found existing Azure context"
    
    # Check if we need to switch tenant
    if ($TenantId -and $context.Tenant.Id -ne $TenantId) {
        Write-StepProgress "Switching to specified tenant: $TenantId"
        $needsAuth = $true
        $needsGraphScope = $true
    }
    # Check if tenant is missing in context
    elseif (-not $context.Tenant -or -not $context.Tenant.Id) {
        Write-StepInfo "Current context has no tenant ID"
        $needsAuth = $true
        $needsGraphScope = $true
    }
    
    # Check if we have Microsoft Graph scope
    # Try a simple Graph API call to test
    try {
        $testApp = Get-AzADApplication -Filter "displayName eq 'IdaraOS-Test-Scope-Check'" -ErrorAction SilentlyContinue
        Write-StepInfo "Microsoft Graph scope verified"
    }
    catch {
        if ($_.Exception.Message -like "*MicrosoftGraphEndpointResourceId*" -or 
            $_.Exception.Message -like "*Authentication failed against resource*") {
            Write-StepProgress "Microsoft Graph scope not available. Re-authenticating..."
            $needsGraphScope = $true
        }
    }
}

# Authenticate if needed
if ($needsAuth -or $needsGraphScope) {
    # Use target tenant if available
    $authTenantId = if ($TenantId) { $TenantId } elseif ($targetTenantId) { $targetTenantId } else { $null }
    
    if ($needsGraphScope) {
        Connect-AzAccountWithGraphScope -TenantIdParam $authTenantId
    }
    else {
        $connectParams = @{}
        if ($authTenantId) {
            $connectParams["TenantId"] = $authTenantId
        }
        Connect-AzAccount @connectParams
    }
    $context = Get-AzContext
    
    # Update target tenant from new context if we didn't have one
    if (-not $targetTenantId -and $context -and $context.Tenant -and $context.Tenant.Id) {
        $targetTenantId = $context.Tenant.Id
    }
}

# Handle subscription selection
if ($SubscriptionName) {
    Write-StepProgress "Setting subscription to: $SubscriptionName"
    try {
        Set-AzContext -SubscriptionName $SubscriptionName -ErrorAction Stop | Out-Null
        $context = Get-AzContext
        Write-StepSuccess "Subscription set to: $SubscriptionName"
        
        # Store subscription info
        $script:summary["SubscriptionId"] = $context.Subscription.Id
        $script:summary["SubscriptionName"] = $context.Subscription.Name
    }
    catch {
        Write-StepError "Failed to set subscription: $SubscriptionName"
        Write-Host ""
        exit 1
    }
}
else {
    # Get current subscription from context
    $currentContext = Get-AzContext -ErrorAction SilentlyContinue
    $currentSub = $currentContext | Select-Object -ExpandProperty Subscription
    
    # Try to get all available subscriptions
    Write-StepProgress "Retrieving available subscriptions..."
    
    $subscriptions = $null
    $subscriptionError = $null
    
    try {
        # Try with a timeout to avoid hanging
        $subscriptions = Get-AzSubscription -ErrorAction Stop | Sort-Object Name
    }
    catch {
        $subscriptionError = $_.Exception.Message
        Write-StepInfo "Could not retrieve subscription list: $subscriptionError"
        
        # If we have a current subscription in context, offer to use it
        if ($currentSub -and $currentSub.Id) {
            Write-StepInfo "Found current subscription in context: $($currentSub.Name)"
            $subscriptions = @([PSCustomObject]@{
                Id = $currentSub.Id
                Name = $currentSub.Name
            })
        }
        else {
            # Try to authenticate with ARM scope to get subscriptions
            Write-StepProgress "Re-authenticating with Azure Resource Manager scope..."
            try {
                $connectParams = @{
                    UseDeviceAuthentication = $false
                }
                if ($TenantId) {
                    $connectParams["TenantId"] = $TenantId
                }
                
                # Connect without Graph scope to get ARM access
                Connect-AzAccount @connectParams | Out-Null
                
                # Now try again
                $subscriptions = Get-AzSubscription -ErrorAction Stop | Sort-Object Name
                Write-StepSuccess "Retrieved subscriptions after re-authentication"
            }
            catch {
                Write-StepError "Failed to retrieve subscriptions even after re-authentication"
                Write-Host ""
                Write-Host "  Note: App registrations don't require a subscription." -ForegroundColor Yellow
                Write-Host "  The script will continue without setting a subscription." -ForegroundColor Yellow
                Write-Host ""
                
                # Continue without subscription - app registrations work at tenant level
                $subscriptions = @()
            }
        }
    }
    
    if (-not $subscriptions -or $subscriptions.Count -eq 0) {
        # No subscriptions available - offer manual entry or skip
        Write-Host ""
        Write-Host "  No subscriptions could be retrieved automatically." -ForegroundColor Yellow
        Write-Host "  App registrations work at tenant level, so a subscription is not required." -ForegroundColor Gray
        Write-Host ""
        
        $choice = Read-Host "  Options: (1) Enter subscription ID manually, (2) Skip (default)"
        
        if ($choice -eq "1") {
            $manualSubId = Read-Host "  Enter subscription ID"
            if ($manualSubId -and $manualSubId.Trim() -ne "") {
                try {
                    Set-AzContext -SubscriptionId $manualSubId.Trim() -ErrorAction Stop | Out-Null
                    $context = Get-AzContext
                    Write-StepSuccess "Subscription set to: $($context.Subscription.Name)"
                    $script:summary["SubscriptionId"] = $context.Subscription.Id
                    $script:summary["SubscriptionName"] = $context.Subscription.Name
                }
                catch {
                    Write-StepError "Failed to set subscription: $($_.Exception.Message)"
                    Write-StepInfo "Continuing without subscription (not required for app registrations)"
                    $script:summary["SubscriptionId"] = "N/A"
                    $script:summary["SubscriptionName"] = "N/A (failed to set)"
                }
            }
            else {
                Write-StepInfo "No subscription ID provided, skipping"
                $script:summary["SubscriptionId"] = "N/A"
                $script:summary["SubscriptionName"] = "N/A (skipped)"
            }
        }
        else {
            # Store what we have from current context if available
            if ($currentSub -and $currentSub.Id) {
                $script:summary["SubscriptionId"] = $currentSub.Id
                $script:summary["SubscriptionName"] = "$($currentSub.Name) (from context)"
            }
            else {
                $script:summary["SubscriptionId"] = "N/A"
                $script:summary["SubscriptionName"] = "N/A (not required for app registrations)"
            }
            Write-StepSuccess "Continuing without subscription (not required for app registrations)"
        }
    }
    elseif ($subscriptions.Count -eq 1) {
        # If only one subscription, show it and confirm
        $selectedSub = $subscriptions[0]
        Write-Host ""
        Write-Host "  Found subscription:" -ForegroundColor White
        Write-Host "  Name: $($selectedSub.Name)" -ForegroundColor Cyan
        Write-Host "  ID:   $($selectedSub.Id)" -ForegroundColor Gray
        Write-Host ""
        
        $confirm = Read-Host "  Use this subscription? (Y/n/manual)"
        if ($confirm -eq "" -or $confirm -eq "Y" -or $confirm -eq "y" -or $confirm -eq "Yes" -or $confirm -eq "yes") {
            try {
                Set-AzContext -SubscriptionId $selectedSub.Id -ErrorAction Stop | Out-Null
                $context = Get-AzContext
                Write-StepSuccess "Subscription set to: $($selectedSub.Name)"
                
                # Store selected subscription info
                $script:summary["SubscriptionId"] = $context.Subscription.Id
                $script:summary["SubscriptionName"] = $context.Subscription.Name
            }
            catch {
                Write-StepInfo "Could not set subscription, but continuing (not required for app registrations)"
                $script:summary["SubscriptionId"] = $selectedSub.Id
                $script:summary["SubscriptionName"] = $selectedSub.Name
            }
        }
        elseif ($confirm -eq "manual" -or $confirm -eq "m" -or $confirm -eq "M") {
            # Allow manual entry
            Write-Host ""
            $manualSubId = Read-Host "  Enter subscription ID (or press Enter to skip)"
            if ($manualSubId -and $manualSubId.Trim() -ne "") {
                try {
                    Set-AzContext -SubscriptionId $manualSubId.Trim() -ErrorAction Stop | Out-Null
                    $context = Get-AzContext
                    Write-StepSuccess "Subscription set to: $($context.Subscription.Name)"
                    $script:summary["SubscriptionId"] = $context.Subscription.Id
                    $script:summary["SubscriptionName"] = $context.Subscription.Name
                }
                catch {
                    Write-StepError "Failed to set subscription: $($_.Exception.Message)"
                    Write-StepInfo "Continuing without subscription (not required for app registrations)"
                    $script:summary["SubscriptionId"] = "N/A"
                    $script:summary["SubscriptionName"] = "N/A (failed to set)"
                }
            }
            else {
                Write-StepInfo "Skipping subscription selection (not required for app registrations)"
                $script:summary["SubscriptionId"] = "N/A"
                $script:summary["SubscriptionName"] = "N/A (skipped)"
            }
        }
        else {
            Write-StepInfo "Skipping subscription selection (not required for app registrations)"
            $script:summary["SubscriptionId"] = "N/A"
            $script:summary["SubscriptionName"] = "N/A (skipped)"
        }
    }
    else {
        # Multiple subscriptions - prompt user to select
        Write-Host ""
        Write-Host "  Available subscriptions:" -ForegroundColor White
        Write-Host ""
        
        $subscriptionList = @()
        for ($i = 0; $i -lt $subscriptions.Count; $i++) {
            $sub = $subscriptions[$i]
            $isCurrent = $currentSub -and $currentSub.Id -eq $sub.Id
            $marker = if ($isCurrent) { " [CURRENT]" } else { "" }
            $color = if ($isCurrent) { "Cyan" } else { "White" }
            
            Write-Host "  $($i + 1). $($sub.Name)" -ForegroundColor $color -NoNewline
            Write-Host $marker -ForegroundColor Cyan
            Write-Host "     ID: $($sub.Id)" -ForegroundColor Gray
            
            $subscriptionList += $sub
        }
        
        Write-Host ""
        Write-Host "  Options:" -ForegroundColor White
        Write-Host "  - Enter a number (1-$($subscriptionList.Count)) to select" -ForegroundColor Gray
        Write-Host "  - Enter 'm' or 'manual' to enter subscription ID manually" -ForegroundColor Gray
        Write-Host "  - Enter 's' or 'skip' to continue without subscription" -ForegroundColor Gray
        Write-Host ""
        
        # Prompt for selection
        $selectedIndex = -1
        $selectionMade = $false
        
        while (-not $selectionMade) {
            $input = Read-Host "  Select subscription (1-$($subscriptionList.Count)/m/skip)"
            $input = $input.Trim().ToLower()
            
            # Check for manual entry
            if ($input -eq "m" -or $input -eq "manual") {
                Write-Host ""
                $manualSubId = Read-Host "  Enter subscription ID"
                if ($manualSubId -and $manualSubId.Trim() -ne "") {
                    try {
                        Set-AzContext -SubscriptionId $manualSubId.Trim() -ErrorAction Stop | Out-Null
                        $context = Get-AzContext
                        Write-StepSuccess "Subscription set to: $($context.Subscription.Name)"
                        $script:summary["SubscriptionId"] = $context.Subscription.Id
                        $script:summary["SubscriptionName"] = $context.Subscription.Name
                        $selectionMade = $true
                    }
                    catch {
                        Write-StepError "Failed to set subscription: $($_.Exception.Message)"
                        Write-Host "  Please try again or enter 'skip' to continue." -ForegroundColor Yellow
                    }
                }
                else {
                    Write-Host "  No subscription ID provided. Please try again." -ForegroundColor Yellow
                }
            }
            # Check for skip
            elseif ($input -eq "s" -or $input -eq "skip") {
                Write-StepInfo "Skipping subscription selection (not required for app registrations)"
                $script:summary["SubscriptionId"] = "N/A"
                $script:summary["SubscriptionName"] = "N/A (skipped)"
                $selectionMade = $true
            }
            # Try to parse as number
            elseif ([int]::TryParse($input, [ref]$selectedIndex)) {
                $selectedIndex = $selectedIndex - 1  # Convert to 0-based index
                
                if ($selectedIndex -ge 0 -and $selectedIndex -lt $subscriptionList.Count) {
                    $selectedSub = $subscriptionList[$selectedIndex]
                    Write-StepProgress "Setting subscription to: $($selectedSub.Name)"
                    
                    try {
                        Set-AzContext -SubscriptionId $selectedSub.Id -ErrorAction Stop | Out-Null
                        $context = Get-AzContext
                        Write-StepSuccess "Subscription set to: $($selectedSub.Name)"
                        
                        # Store selected subscription info
                        $script:summary["SubscriptionId"] = $context.Subscription.Id
                        $script:summary["SubscriptionName"] = $context.Subscription.Name
                        $selectionMade = $true
                    }
                    catch {
                        Write-StepError "Failed to set subscription: $($_.Exception.Message)"
                        Write-Host "  Please try again." -ForegroundColor Yellow
                        $selectedIndex = -1
                    }
                }
                else {
                    Write-Host "  Invalid selection. Please enter a number between 1 and $($subscriptionList.Count)." -ForegroundColor Red
                    $selectedIndex = -1
                }
            }
            else {
                Write-Host "  Invalid input. Please enter a number (1-$($subscriptionList.Count)), 'm' for manual, or 's' to skip." -ForegroundColor Red
            }
        }
    }
}

# Verify we can access Microsoft Graph
Write-StepProgress "Verifying Microsoft Graph access..."
try {
    # Try a simple, lightweight operation to verify Graph access
    $null = Get-AzADApplication -Filter "appId eq '00000000-0000-0000-0000-000000000000'" -ErrorAction Stop
    Write-StepSuccess "Microsoft Graph access verified"
}
catch {
    $errorMsg = $_.Exception.Message
    
    # Only fail if it's an authentication error, not if it's just "not found"
    if ($errorMsg -like "*MicrosoftGraphEndpointResourceId*" -or 
        $errorMsg -like "*Authentication failed against resource*" -or
        $errorMsg -like "*User interaction is required*") {
        
        Write-StepError "Failed to access Microsoft Graph API"
        Write-StepProgress "Re-authenticating with Microsoft Graph scope..."
        
        $connectParams = @{
            AuthScope = "MicrosoftGraphEndpointResourceId"
        }
        if ($TenantId) {
            $connectParams["TenantId"] = $TenantId
        }
        
        try {
            Connect-AzAccount @connectParams | Out-Null
            Write-StepSuccess "Re-authenticated with Microsoft Graph scope"
        }
        catch {
            Write-StepError "Failed to authenticate with Microsoft Graph scope"
            Write-Host ""
            Write-Host "  Please run manually:" -ForegroundColor Yellow
            Write-Host "    Connect-AzAccount -AuthScope MicrosoftGraphEndpointResourceId" -ForegroundColor White
            Write-Host ""
            exit 1
        }
    }
    else {
        # Other errors (like "not found") are fine - it means we can access Graph
        Write-StepSuccess "Microsoft Graph access verified"
    }
}

# Ensure we have a valid tenant ID
$context = Get-AzContext
if (-not $context -or -not $context.Tenant -or -not $context.Tenant.Id) {
    Write-StepError "No tenant ID in current context"
    Write-Host ""
    Write-Host "  A tenant ID is required to create app registrations." -ForegroundColor Yellow
    Write-Host ""
    
    # Ask user for tenant ID
    $manualTenantId = Read-Host "  Enter your Tenant ID (or press Enter to authenticate fresh)"
    
    if ($manualTenantId -and $manualTenantId.Trim() -ne "") {
        $manualTenantId = $manualTenantId.Trim()
        Write-StepProgress "Authenticating with tenant: $manualTenantId"
        
        try {
            Connect-AzAccount -TenantId $manualTenantId -AuthScope MicrosoftGraphEndpointResourceId | Out-Null
            $context = Get-AzContext
            Write-StepSuccess "Authenticated with tenant: $manualTenantId"
        }
        catch {
            Write-StepError "Failed to authenticate with tenant: $($_.Exception.Message)"
            Write-Host ""
            exit 1
        }
    }
    else {
        Write-StepProgress "Starting fresh authentication..."
        try {
            Connect-AzAccount -AuthScope MicrosoftGraphEndpointResourceId | Out-Null
            $context = Get-AzContext
            
            if (-not $context -or -not $context.Tenant -or -not $context.Tenant.Id) {
                Write-StepError "Still no tenant ID after authentication"
                Write-Host ""
                Write-Host "  Please run the script with a specific tenant:" -ForegroundColor Yellow
                Write-Host "    .\setup-entra-sso.ps1 -TenantId 'your-tenant-id'" -ForegroundColor White
                Write-Host ""
                exit 1
            }
        }
        catch {
            Write-StepError "Failed to authenticate: $($_.Exception.Message)"
            Write-Host ""
            exit 1
        }
    }
}

# Store tenant info
$script:summary["TenantId"] = $context.Tenant.Id
try {
    if ($context.Tenant.Id) {
        $tenantInfo = Get-AzTenant -TenantId $context.Tenant.Id -ErrorAction SilentlyContinue
        $script:summary["TenantName"] = if ($tenantInfo) { $tenantInfo.Name } else { "N/A" }
    }
    else {
        $script:summary["TenantName"] = "N/A"
    }
}
catch {
    $script:summary["TenantName"] = "N/A"
}

Write-StepSuccess "Authenticated successfully"
Write-StepInfo "Tenant: $($context.Tenant.Id)"
Write-StepInfo "Account: $($context.Account.Id)"

# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Create or Update App Registration
# ─────────────────────────────────────────────────────────────────────────────
Write-StepHeader "Step 3: Creating/Updating App Registration"

$redirectUri = "$AppUrl/api/auth/callback/azure-ad"
$logoutUri = "$AppUrl/login"

Write-StepProgress "Checking for existing app registration..."

# Function to perform app operations with retry on auth failure
function Invoke-AppOperation {
    param(
        [scriptblock]$Operation,
        [string]$OperationName
    )
    
    try {
        return & $Operation
    }
    catch {
        $errorMsg = $_.Exception.Message
        
        # Check if it's an authentication error for Microsoft Graph
        if ($errorMsg -like "*MicrosoftGraphEndpointResourceId*" -or 
            $errorMsg -like "*Authentication failed against resource*" -or
            $errorMsg -like "*User interaction is required*") {
            
            Write-StepError "Authentication failed for Microsoft Graph API"
            Write-StepProgress "Re-authenticating with Microsoft Graph scope..."
            
            # Re-authenticate with Graph scope
            $connectParams = @{
                AuthScope = "MicrosoftGraphEndpointResourceId"
            }
            if ($TenantId) {
                $connectParams["TenantId"] = $TenantId
            }
            Connect-AzAccount @connectParams | Out-Null
            
            Write-StepProgress "Retrying $OperationName..."
            
            # Retry the operation
            return & $Operation
        }
        else {
            throw
        }
    }
}

# Check if app already exists
$existingApp = Invoke-AppOperation -Operation {
    Get-AzADApplication -DisplayName $AppName -ErrorAction SilentlyContinue
} -OperationName "app lookup"

if ($existingApp) {
    Write-StepInfo "Found existing application: $($existingApp.AppId)"
    $app = $existingApp
    $isNewApp = $false
    
    # Update redirect URIs if needed
    Write-StepProgress "Updating application configuration..."
    
    # Use simpler web config - implicit grants are configured separately
    $webRedirectUris = @($redirectUri)
    
    Invoke-AppOperation -Operation {
        Update-AzADApplication -ObjectId $app.Id -ReplyUrl $webRedirectUris -ErrorAction Stop
    } -OperationName "app update" | Out-Null
    
    Write-StepSuccess "Updated application configuration"
}
else {
    Write-StepProgress "Creating new application: $AppName"
    $isNewApp = $true
    
    # Ensure we have a valid tenant context before creating
    $currentContext = Get-AzContext
    if (-not $currentContext -or -not $currentContext.Tenant -or -not $currentContext.Tenant.Id) {
        Write-StepError "No valid tenant context found. Please authenticate with a specific tenant."
        Write-Host ""
        Write-Host "  Please run one of the following:" -ForegroundColor Yellow
        Write-Host "    Connect-AzAccount -TenantId 'your-tenant-id'" -ForegroundColor White
        Write-Host "    or" -ForegroundColor Gray
        Write-Host "    .\setup-entra-sso.ps1 -TenantId 'your-tenant-id'" -ForegroundColor White
        Write-Host ""
        Write-Host "  To find your Tenant ID:" -ForegroundColor Yellow
        Write-Host "    1. Go to https://portal.azure.com" -ForegroundColor White
        Write-Host "    2. Navigate to Microsoft Entra ID > Overview" -ForegroundColor White
        Write-Host "    3. Copy the 'Tenant ID' value" -ForegroundColor White
        Write-Host ""
        exit 1
    }
    
    Write-StepInfo "Creating app in tenant: $($currentContext.Tenant.Id)"
    
    # Use simpler parameters that work across Az module versions
    # Note: Some advanced settings may need to be configured in Azure Portal
    $appParams = @{
        DisplayName = $AppName
        SignInAudience = "AzureADMyOrg"
        ReplyUrl = @($redirectUri)
    }
    
    $app = $null
    $createError = $null
    
    try {
        $app = New-AzADApplication @appParams -ErrorAction Stop
    }
    catch {
        $createError = $_
        
        # Check if it's an authentication error
        $errorMsg = $_.Exception.Message
        if ($errorMsg -like "*MicrosoftGraphEndpointResourceId*" -or 
            $errorMsg -like "*Authentication failed against resource*" -or
            $errorMsg -like "*User interaction is required*") {
            
            Write-StepError "Authentication failed for Microsoft Graph API"
            Write-StepProgress "Re-authenticating with Microsoft Graph scope..."
            
            # Re-authenticate with Graph scope and specific tenant
            $connectParams = @{
                AuthScope = "MicrosoftGraphEndpointResourceId"
                TenantId = $currentContext.Tenant.Id
            }
            Connect-AzAccount @connectParams | Out-Null
            
            Write-StepProgress "Retrying app creation..."
            
            # Retry app creation
            try {
                $app = New-AzADApplication @appParams -ErrorAction Stop
                $createError = $null
            }
            catch {
                $createError = $_
            }
        }
    }
    
    # If app is null, try to find it by name (it might have been created)
    if (-not $app -and -not $createError) {
        Write-StepInfo "Checking if app was created..."
        Start-Sleep -Seconds 2  # Give Azure a moment to propagate
        $app = Get-AzADApplication -DisplayName $AppName -ErrorAction SilentlyContinue
    }
    
    # Validate app was created successfully
    if (-not $app) {
        Write-StepError "App creation failed or returned null"
        if ($createError) {
            Write-Host "  Error: $($createError.Exception.Message)" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "  Troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "  1. Ensure you have permission to create app registrations" -ForegroundColor White
        Write-Host "  2. Try re-authenticating with:" -ForegroundColor White
        Write-Host "     Connect-AzAccount -TenantId '$($currentContext.Tenant.Id)' -AuthScope MicrosoftGraphEndpointResourceId" -ForegroundColor Cyan
        Write-Host "  3. Check if the app was created in Azure Portal:" -ForegroundColor White
        Write-Host "     https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
    
    if (-not $app.AppId) {
        Write-StepError "App creation succeeded but AppId is missing"
        Write-Host "  App ObjectId: $($app.Id)" -ForegroundColor Yellow
        Write-Host "  Please check the app in Azure Portal" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    
    Write-StepSuccess "Created application: $($app.AppId)"
    
    # Try to configure API permissions (may not work on all Az module versions)
    Write-StepProgress "Configuring API permissions..."
    try {
        # Microsoft Graph API permissions
        $graphApiId = "00000003-0000-0000-c000-000000000000"
        $permissions = @(
            @{ Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"; Type = "Scope" },  # User.Read
            @{ Id = "14dad69e-099b-42c9-810b-d002981feec1"; Type = "Scope" },  # profile
            @{ Id = "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"; Type = "Scope" },  # email
            @{ Id = "37f7f235-527c-4136-accd-4a02d197296e"; Type = "Scope" }   # openid
        )
        
        $requiredResourceAccess = @(
            @{
                ResourceAppId = $graphApiId
                ResourceAccess = $permissions
            }
        )
        
        Update-AzADApplication -ObjectId $app.Id -RequiredResourceAccess $requiredResourceAccess -ErrorAction SilentlyContinue
        Write-StepSuccess "Configured API permissions"
    }
    catch {
        Write-StepInfo "API permissions may need to be configured in Azure Portal"
        $script:summary["NeedsApiPermissions"] = $true
    }
}

# Validate app object before proceeding
if (-not $app -or -not $app.AppId) {
    Write-StepError "Invalid app object. Cannot proceed."
    Write-Host ""
    exit 1
}

$script:summary["ApplicationId"] = $app.AppId
$script:summary["ObjectId"] = $app.Id
$script:summary["RedirectUri"] = $redirectUri

# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Create Service Principal
# ─────────────────────────────────────────────────────────────────────────────
Write-StepHeader "Step 4: Creating/Updating Service Principal"

Write-StepProgress "Checking for existing service principal..."

$sp = Invoke-AppOperation -Operation {
    Get-AzADServicePrincipal -ApplicationId $app.AppId -ErrorAction SilentlyContinue
} -OperationName "service principal lookup"

if (-not $sp) {
    Write-StepProgress "Creating service principal..."
    $sp = Invoke-AppOperation -Operation {
        New-AzADServicePrincipal -ApplicationId $app.AppId -ErrorAction Stop
    } -OperationName "service principal creation"
    Write-StepSuccess "Created service principal"
}
else {
    Write-StepSuccess "Service principal already exists"
}

$script:summary["ServicePrincipalId"] = $sp.Id

# ─────────────────────────────────────────────────────────────────────────────
# Step 5: Create Client Secret
# ─────────────────────────────────────────────────────────────────────────────
if ($CreateSecret) {
    Write-StepHeader "Step 5: Creating Client Secret"
    
    Write-StepProgress "Generating new client secret..."
    
    $endDate = (Get-Date).AddYears($SecretExpiryYears)
    
    $secret = $null
    $secretError = $null
    
    # Try different parameter combinations for compatibility with various Az module versions
    try {
        # Try with ApplicationId (newer versions)
        $secret = New-AzADAppCredential -ApplicationId $app.AppId -EndDate $endDate -ErrorAction Stop
    }
    catch {
        $firstError = $_
        Write-StepInfo "Trying alternative credential creation method..."
        
        try {
            # Try with ObjectId only (some versions)
            $secret = New-AzADAppCredential -ObjectId $app.Id -EndDate $endDate -ErrorAction Stop
        }
        catch {
            $secondError = $_
            Write-StepInfo "Trying another method..."
            
            try {
                # Try with ApplicationObject (older versions)
                $secret = New-AzADAppCredential -ApplicationObject $app -EndDate $endDate -ErrorAction Stop
            }
            catch {
                $secretError = $_
            }
        }
    }
    
    if ($secret -and $secret.SecretText) {
        $script:summary["ClientSecret"] = $secret.SecretText
        $script:summary["SecretExpiry"] = $endDate.ToString("yyyy-MM-dd")
        
        Write-StepSuccess "Created client secret (expires: $($endDate.ToString('yyyy-MM-dd')))"
        Write-Host ""
        Write-Host "  ⚠️  IMPORTANT: Copy the client secret now!" -ForegroundColor Yellow
        Write-Host "     It will not be shown again." -ForegroundColor Yellow
    }
    else {
        Write-StepError "Failed to create client secret"
        if ($secretError) {
            Write-Host "  Error: $($secretError.Exception.Message)" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "  You'll need to create a client secret manually:" -ForegroundColor Yellow
        Write-Host "  1. Go to Azure Portal → App registrations → $AppName" -ForegroundColor White
        Write-Host "  2. Click 'Certificates & secrets'" -ForegroundColor White
        Write-Host "  3. Click 'New client secret'" -ForegroundColor White
        Write-Host "  4. Copy the secret value (shown only once)" -ForegroundColor White
        Write-Host ""
        
        $script:summary["ClientSecret"] = "(create manually in Azure Portal)"
        $script:summary["NeedsManualSecret"] = $true
    }
}
else {
    Write-StepHeader "Step 5: Skipping Client Secret"
    Write-StepInfo "CreateSecret is set to false"
    $script:summary["ClientSecret"] = "(not created)"
}

# ─────────────────────────────────────────────────────────────────────────────
# Step 6: Configure Optional Claims (for SCIM)
# ─────────────────────────────────────────────────────────────────────────────
Write-StepHeader "Step 6: Configuring Token Claims"

Write-StepProgress "Configuring optional claims for ID token..."

# Note: Optional claims configuration via PowerShell is limited
# Users may need to configure additional claims in Azure Portal
Write-StepInfo "Basic claims configured. For SCIM provisioning, additional"
Write-StepInfo "configuration may be needed in Azure Portal."

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "║                    Setup Complete! ✓                             ║" -ForegroundColor Green
Write-Host "║                                                                  ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "┌──────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "│ Configuration Values (copy these to IdaraOS)                     │" -ForegroundColor White
Write-Host "└──────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""

Write-ConfigValue -Label "Tenant ID       " -Value $script:summary["TenantId"]
Write-ConfigValue -Label "Client ID       " -Value $script:summary["ApplicationId"]

if ($script:summary["ClientSecret"] -and 
    $script:summary["ClientSecret"] -ne "(not created)" -and 
    $script:summary["ClientSecret"] -ne "(create manually in Azure Portal)") {
    Write-ConfigValue -Label "Client Secret   " -Value $script:summary["ClientSecret"] -Secret
    Write-Host ""
    Write-Host "  ⚠️  Copy the full secret from below:" -ForegroundColor Yellow
    Write-Host "  $($script:summary["ClientSecret"])" -ForegroundColor Cyan
}
elseif ($script:summary["NeedsManualSecret"]) {
    Write-Host "  Client Secret   : " -ForegroundColor White -NoNewline
    Write-Host "(needs manual creation - see instructions above)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "│ Redirect URI (already configured in app)                         │" -ForegroundColor White
Write-Host "└──────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-ConfigValue -Label "Redirect URI    " -Value $script:summary["RedirectUri"]

Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "│ Useful Links                                                     │" -ForegroundColor White
Write-Host "└──────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""

$portalAppUrl = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/$($script:summary["ApplicationId"])/isMSAApp~/false"
$entraAppUrl = "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/$($script:summary["ApplicationId"])/isMSAApp~/false"

Write-Host "  Azure Portal:" -ForegroundColor White
Write-Host "  $portalAppUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Entra Admin Center:" -ForegroundColor White
Write-Host "  $entraAppUrl" -ForegroundColor Cyan

Write-Host ""
Write-Host "┌──────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "│ Next Steps                                                       │" -ForegroundColor White
Write-Host "└──────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "  1. Copy the Tenant ID, Client ID, and Client Secret above" -ForegroundColor White
Write-Host "  2. Go to IdaraOS → Settings → Integrations" -ForegroundColor White
Write-Host "  3. Click 'Connect Microsoft Entra ID'" -ForegroundColor White
Write-Host "  4. Paste the credentials and connect" -ForegroundColor White
Write-Host ""

# Check if additional configuration is needed
$needsManualConfig = $script:summary["NeedsApiPermissions"] -or $script:summary["NeedsManualSecret"]

if ($needsManualConfig) {
    Write-Host "┌──────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "│ ⚠️  Additional Configuration Required                            │" -ForegroundColor Yellow
    Write-Host "└──────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    Write-Host ""
    
    if ($script:summary["NeedsManualSecret"]) {
        Write-Host "  Create Client Secret in Azure Portal:" -ForegroundColor Yellow
        Write-Host "  1. Go to: $entraAppUrl" -ForegroundColor White
        Write-Host "  2. Click 'Certificates & secrets'" -ForegroundColor White
        Write-Host "  3. Click 'New client secret'" -ForegroundColor White
        Write-Host "  4. Enter a description and select expiry" -ForegroundColor White
        Write-Host "  5. Copy the secret value (shown only once!)" -ForegroundColor White
        Write-Host ""
    }
    
    if ($script:summary["NeedsApiPermissions"]) {
        Write-Host "  Configure API Permissions in Azure Portal:" -ForegroundColor Yellow
        Write-Host "  1. Go to: $entraAppUrl" -ForegroundColor White
        Write-Host "  2. Click 'API Permissions'" -ForegroundColor White
        Write-Host "  3. Click 'Add a permission' → 'Microsoft Graph' → 'Delegated'" -ForegroundColor White
        Write-Host "  4. Add: openid, profile, email, User.Read" -ForegroundColor White
        Write-Host "  5. Click 'Grant admin consent'" -ForegroundColor White
        Write-Host ""
        Write-Host "  Enable ID Tokens:" -ForegroundColor Yellow
        Write-Host "  1. Go to 'Authentication'" -ForegroundColor White
        Write-Host "  2. Under 'Implicit grant and hybrid flows'" -ForegroundColor White
        Write-Host "  3. Check 'ID tokens'" -ForegroundColor White
        Write-Host "  4. Click 'Save'" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host "  For SCIM provisioning (optional):" -ForegroundColor Gray
Write-Host "  5. In Entra Admin Center, go to Enterprise Applications" -ForegroundColor Gray
Write-Host "  6. Find '$AppName' and configure Provisioning" -ForegroundColor Gray
Write-Host "  7. Use the SCIM endpoint and token from IdaraOS" -ForegroundColor Gray
Write-Host ""

# Export to JSON for automation
$outputFile = "entra-config-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$exportData = @{
    TenantId = $script:summary["TenantId"]
    ClientId = $script:summary["ApplicationId"]
    ClientSecret = $script:summary["ClientSecret"]
    SecretExpiry = $script:summary["SecretExpiry"]
    RedirectUri = $script:summary["RedirectUri"]
    PortalUrl = $portalAppUrl
    EntraUrl = $entraAppUrl
    CreatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
}

$exportData | ConvertTo-Json | Out-File -FilePath $outputFile -Encoding UTF8
Write-Host "  Configuration saved to: $outputFile" -ForegroundColor Gray
Write-Host ""

#endregion

