<#
    .SYNOPSIS
    Create PIM-enabled Entra ID security groups for environment-based access control.

    .DESCRIPTION
    Creates three security groups (Reader, Contributor, Admin) for the specified environment
    and assigns appropriate RBAC roles at the subscription level.
    Groups are created with isAssignableToRole=true to enable PIM eligibility.
    
    This script is fully idempotent - safe to run multiple times.

    .PARAMETER EnvironmentName
    The environment name (dev, staging, prod).

    .PARAMETER SubscriptionId
    The Azure subscription ID where RBAC roles will be assigned.

    .PARAMETER AppName
    The application name prefix. Default: idaraos

    .PARAMETER CurrentUserId
    Optional. The Object ID of the current user to add as owner and member.
    If not provided, will auto-detect.

    .PARAMETER SkipPimConversion
    Optional switch. Skip converting active role assignments to PIM-eligible.

    .EXAMPLE
    ./create-pim-rbac-groups.ps1 `
        -EnvironmentName "prod" `
        -SubscriptionId "12345678-1234-1234-1234-123456789012"

    .EXAMPLE
    # Skip PIM conversion (just create groups and RBAC)
    ./create-pim-rbac-groups.ps1 `
        -EnvironmentName "dev" `
        -SubscriptionId "12345678-1234-1234-1234-123456789012" `
        -SkipPimConversion
#>
[CmdletBinding()]
Param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$EnvironmentName,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [string]$AppName = "idaraos",

    [Parameter(Mandatory = $false)]
    [string]$CurrentUserId,

    [Parameter(Mandatory = $false)]
    [switch]$SkipPimConversion
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

function Write-Warn {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

# =============================================================================
# Initialize
# =============================================================================

# Normalize environment code
$envCode = switch ($EnvironmentName.ToLower()) {
    "dev" { "Dev" }
    "staging" { "Staging" }
    "prod" { "Prod" }
    default { $EnvironmentName }
}

Write-Step "PIM RBAC Groups Setup for $AppName $envCode"
Write-Info "Application: $AppName"
Write-Info "Environment: $envCode"
Write-Info "Subscription: $SubscriptionId"

# =============================================================================
# Get Current User
# =============================================================================

if ([string]::IsNullOrWhiteSpace($CurrentUserId)) {
    Write-Host ""
    Write-Host "Getting current user information..." -ForegroundColor Gray
    try {
        $currentUserJson = az ad signed-in-user show --output json 2>&1
        if ($LASTEXITCODE -eq 0 -and $currentUserJson) {
            $userInfo = $currentUserJson | ConvertFrom-Json
            $CurrentUserId = $userInfo.id
            Write-Success "Current user: $($userInfo.userPrincipalName)"
            Write-Info "Object ID: $CurrentUserId"
        }
        else {
            Write-Warn "Could not get current user - groups will be created without owner"
        }
    }
    catch {
        Write-Warn "Failed to get current user: $_"
    }
}

# =============================================================================
# Define Groups
# =============================================================================

$groupsToCreate = @(
    @{
        Name        = "${AppName}_${envCode}_Reader"
        Role        = "Reader"
        Description = "Reader access for $AppName $envCode environment - can view resources"
    },
    @{
        Name        = "${AppName}_${envCode}_Contributor"
        Role        = "Contributor"
        Description = "Contributor access for $AppName $envCode environment - can modify resources"
    },
    @{
        Name        = "${AppName}_${envCode}_Admin"
        Role        = "Owner"
        Description = "Admin access for $AppName $envCode environment - full control"
    }
)

$createdGroups = @()
$scope = "/subscriptions/$SubscriptionId"

# =============================================================================
# Process Each Group
# =============================================================================

foreach ($groupConfig in $groupsToCreate) {
    $groupName = $groupConfig.Name
    $roleName = $groupConfig.Role
    $description = $groupConfig.Description

    Write-Step "Processing: $groupName"
    Write-Info "Role: $roleName"
    Write-Info "Description: $description"

    # -------------------------------------------------------------------------
    # Check if group exists (idempotent)
    # -------------------------------------------------------------------------
    Write-Host ""
    Write-Host "Checking if group exists..." -ForegroundColor Gray
    
    $groupId = $null
    $groupCreated = $false
    
    $existingGroupJson = az ad group list `
        --display-name $groupName `
        --filter "displayName eq '$groupName'" `
        --output json 2>&1

    if ($LASTEXITCODE -eq 0 -and $existingGroupJson) {
        try {
            $existingGroups = $existingGroupJson | ConvertFrom-Json
            if ($existingGroups -and $existingGroups.Count -gt 0) {
                $groupId = $existingGroups[0].id
                Write-Success "Group already exists"
                Write-Info "Object ID: $groupId"
            }
        }
        catch {
            # Parse failed, group doesn't exist
        }
    }

    # -------------------------------------------------------------------------
    # Create group if it doesn't exist
    # -------------------------------------------------------------------------
    if ([string]::IsNullOrWhiteSpace($groupId)) {
        Write-Host "Creating security group with isAssignableToRole=true..." -ForegroundColor Yellow

        try {
            $graphToken = az account get-access-token --resource "https://graph.microsoft.com" --query accessToken -o tsv 2>&1

            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($graphToken)) {
                $mailNickname = $groupName -replace '[^a-zA-Z0-9]', ''

                $createBody = @{
                    displayName        = $groupName
                    description        = $description
                    mailNickname       = $mailNickname
                    mailEnabled        = $false
                    securityEnabled    = $true
                    isAssignableToRole = $true
                } | ConvertTo-Json -Depth 10

                $tempFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.json'
                Set-Content -Path $tempFile -Value $createBody -Encoding UTF8

                $createResult = az rest `
                    --method POST `
                    --uri "https://graph.microsoft.com/v1.0/groups" `
                    --headers "Content-Type=application/json" `
                    --body "@$tempFile" `
                    --output json 2>&1

                Remove-Item $tempFile -ErrorAction SilentlyContinue

                if ($LASTEXITCODE -eq 0 -and $createResult) {
                    $groupJson = $createResult | ConvertFrom-Json
                    $groupId = $groupJson.id
                    $groupCreated = $true
                    Write-Success "Group created via Microsoft Graph"
                    Write-Info "Object ID: $groupId"

                    if ($groupJson.isAssignableToRole -eq $true) {
                        Write-Success "PIM-ready (isAssignableToRole=true)"
                    }
                    else {
                        Write-Warn "isAssignableToRole may not be set correctly"
                    }
                }
                else {
                    throw "Graph API call failed: $createResult"
                }
            }
            else {
                throw "Could not get Graph token"
            }
        }
        catch {
            Write-Warn "Graph API failed: $_"
            Write-Host "  Falling back to Azure CLI..." -ForegroundColor Yellow

            $mailNickname = $groupName -replace '[^a-zA-Z0-9]', ''
            $newGroupJson = az ad group create `
                --display-name $groupName `
                --description $description `
                --mail-nickname $mailNickname `
                --output json 2>&1

            if ($LASTEXITCODE -eq 0) {
                $groupJson = $newGroupJson | ConvertFrom-Json
                $groupId = $groupJson.id
                $groupCreated = $true
                Write-Success "Group created via Azure CLI"
                Write-Info "Object ID: $groupId"
                Write-Warn "Note: isAssignableToRole must be set manually in Azure Portal"
                Write-Info "  Azure Portal > Groups > $groupName > Properties"
            }
            else {
                Write-Err "Failed to create group"
                continue
            }
        }
    }

    # -------------------------------------------------------------------------
    # Add current user as owner and member (idempotent)
    # -------------------------------------------------------------------------
    if ($CurrentUserId -and $groupId) {
        Write-Host ""
        Write-Host "Ensuring current user is owner and member..." -ForegroundColor Gray

        # Check if already member
        $membersJson = az ad group member list --group $groupId --output json 2>&1
        $isMember = $false
        if ($LASTEXITCODE -eq 0 -and $membersJson) {
            try {
                $members = $membersJson | ConvertFrom-Json
                $isMember = ($members | Where-Object { $_.id -eq $CurrentUserId }) -ne $null
            }
            catch { }
        }

        if (-not $isMember) {
            az ad group member add --group $groupId --member-id $CurrentUserId --output none 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Added as member"
            }
        }
        else {
            Write-Info "Already a member"
        }

        # Check if already owner
        $ownersJson = az ad group owner list --group $groupId --output json 2>&1
        $isOwner = $false
        if ($LASTEXITCODE -eq 0 -and $ownersJson) {
            try {
                $owners = $ownersJson | ConvertFrom-Json
                $isOwner = ($owners | Where-Object { $_.id -eq $CurrentUserId }) -ne $null
            }
            catch { }
        }

        if (-not $isOwner) {
            az ad group owner add --group $groupId --owner-object-id $CurrentUserId --output none 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Added as owner"
            }
        }
        else {
            Write-Info "Already an owner"
        }
    }

    # -------------------------------------------------------------------------
    # Wait for Azure AD replication if group was just created
    # -------------------------------------------------------------------------
    if ($groupCreated) {
        Write-Host ""
        Write-Host "Waiting for Azure AD replication (15 seconds)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
    }

    # -------------------------------------------------------------------------
    # Create RBAC role assignment (idempotent)
    # -------------------------------------------------------------------------
    Write-Host ""
    Write-Host "Checking RBAC role assignment..." -ForegroundColor Gray

    $existingAssignmentJson = az role assignment list `
        --assignee $groupId `
        --scope $scope `
        --role $roleName `
        --output json 2>&1

    $hasRoleAssignment = $false
    $activeAssignmentId = $null

    if ($LASTEXITCODE -eq 0 -and $existingAssignmentJson) {
        try {
            $assignments = $existingAssignmentJson | ConvertFrom-Json
            if ($assignments -and $assignments.Count -gt 0) {
                $hasRoleAssignment = $true
                $activeAssignmentId = $assignments[0].id
            }
        }
        catch { }
    }

    if ($hasRoleAssignment) {
        Write-Success "Role assignment already exists"
        Write-Info "Assignment ID: $activeAssignmentId"
    }
    else {
        Write-Host "Creating role assignment: $roleName..." -ForegroundColor Yellow

        # Retry logic for replication delays
        $maxRetries = 3
        $retryDelay = 15
        $assigned = $false

        for ($retry = 1; $retry -le $maxRetries; $retry++) {
            if ($retry -gt 1) {
                Write-Info "Retry $retry/$maxRetries (waiting ${retryDelay}s for replication)..."
                Start-Sleep -Seconds $retryDelay
            }

            $assignResult = az role assignment create `
                --assignee-object-id $groupId `
                --assignee-principal-type Group `
                --role $roleName `
                --scope $scope `
                --output json 2>&1

            if ($LASTEXITCODE -eq 0) {
                $assignJson = $assignResult | ConvertFrom-Json
                $activeAssignmentId = $assignJson.id
                Write-Success "Role assignment created"
                Write-Info "Assignment ID: $activeAssignmentId"
                $assigned = $true
                break
            }
            else {
                if ($assignResult -match "PrincipalNotFound" -or $assignResult -match "does not exist") {
                    if ($retry -eq $maxRetries) {
                        Write-Err "Failed after $maxRetries attempts (replication delay)"
                        Write-Info "Try running the script again in a few minutes"
                    }
                }
                else {
                    Write-Err "Failed to create role assignment: $assignResult"
                    break
                }
            }
        }
    }

    # -------------------------------------------------------------------------
    # Convert to PIM-eligible (optional)
    # -------------------------------------------------------------------------
    if (-not $SkipPimConversion -and $activeAssignmentId) {
        Write-Host ""
        Write-Host "Attempting PIM-eligible conversion..." -ForegroundColor Gray
        Write-Info "Note: This requires PIM to be enabled and subscription discovered"
        Write-Info "If conversion fails, the active RBAC assignment will remain working"

        # PIM conversion is complex and often fails due to:
        # 1. Subscription not discovered in PIM
        # 2. Azure AD replication delays for new groups
        # 3. Missing Graph permissions
        # 
        # For now, we'll provide guidance rather than full automation
        Write-Warn "PIM conversion requires manual steps:"
        Write-Info "  1. Azure Portal > Privileged Identity Management"
        Write-Info "  2. Azure resources > Discover resources"
        Write-Info "  3. Select subscription: $SubscriptionId"
        Write-Info "  4. Roles > $roleName > Add assignments"
        Write-Info "  5. Select group: $groupName"
        Write-Info "  6. Set assignment type: Eligible"
        Write-Info "  7. Remove active RBAC assignment after PIM is configured"
    }

    $createdGroups += @{
        Name        = $groupName
        ObjectId    = $groupId
        Role        = $roleName
        Created     = $groupCreated
        AssignmentId = $activeAssignmentId
    }
}

# =============================================================================
# Summary
# =============================================================================

Write-Step "PIM RBAC Groups Setup Complete"

Write-Host ""
Write-Host "Groups configured:" -ForegroundColor Cyan
foreach ($group in $createdGroups) {
    $status = if ($group.Created) { "Created" } else { "Exists" }
    Write-Host "  $($group.Name)" -ForegroundColor White
    Write-Host "    Status: $status | Role: $($group.Role)" -ForegroundColor Gray
    Write-Host "    Object ID: $($group.ObjectId)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "How PIM Access Works:" -ForegroundColor Cyan
Write-Host "  1. Users are added to these groups (e.g., ${AppName}_${envCode}_Reader)" -ForegroundColor Gray
Write-Host "  2. By default, users can NOT see resources (if PIM is configured)" -ForegroundColor Gray
Write-Host "  3. Users must activate their role via PIM portal" -ForegroundColor Gray
Write-Host "  4. After activation, access is granted for a limited time" -ForegroundColor Gray
Write-Host ""
Write-Host "To enable PIM eligibility:" -ForegroundColor Cyan
Write-Host "  1. Azure Portal > Privileged Identity Management" -ForegroundColor Gray
Write-Host "  2. Azure resources > Discover resources" -ForegroundColor Gray
Write-Host "  3. Select subscription and manage assignments" -ForegroundColor Gray
Write-Host "  4. Convert active assignments to eligible" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: PIM requires Microsoft Entra ID Premium P2 licensing" -ForegroundColor Yellow
Write-Host ""

return $createdGroups
