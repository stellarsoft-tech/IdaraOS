<#
    .SYNOPSIS
    Create PIM-enabled Entra ID security groups for environment-based access control.

    .DESCRIPTION
    Creates three security groups (Reader, Contributor, Admin) for the specified environment
    and assigns appropriate RBAC roles at the subscription level.
    Groups are created with isAssignableToRole=true to enable PIM eligibility.

    .PARAMETER EnvironmentName
    The environment name (dev, staging, prod).

    .PARAMETER SubscriptionId
    The Azure subscription ID where RBAC roles will be assigned.

    .PARAMETER AppName
    The application name prefix. Default: idaraos

    .EXAMPLE
    ./create-pim-rbac-groups.ps1 `
        -EnvironmentName "prod" `
        -SubscriptionId "12345678-1234-1234-1234-123456789012" `
        -AppName "idaraos"
#>
[CmdletBinding()]
Param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$EnvironmentName,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [string]$AppName = "idaraos"
)

$ErrorActionPreference = "Stop"

# Normalize environment code
$envCode = switch ($EnvironmentName.ToLower()) {
    "dev" { "Dev" }
    "staging" { "Staging" }
    "prod" { "Prod" }
    default { $EnvironmentName }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating PIM RBAC Groups for $envCode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application: $AppName" -ForegroundColor Yellow
Write-Host "Environment: $envCode" -ForegroundColor Yellow
Write-Host "Subscription: $SubscriptionId" -ForegroundColor Yellow
Write-Host ""

# Define groups and their roles
$groupsToCreate = @(
    @{
        Name        = "${AppName}_${envCode}_Reader"
        Role        = "Reader"
        Description = "Reader access for $AppName $envCode environment"
    },
    @{
        Name        = "${AppName}_${envCode}_Contributor"
        Role        = "Contributor"
        Description = "Contributor access for $AppName $envCode environment"
    },
    @{
        Name        = "${AppName}_${envCode}_Admin"
        Role        = "Owner"
        Description = "Admin (Owner) access for $AppName $envCode environment"
    }
)

# Get current user for adding as owner
$currentUserId = $null
try {
    $currentUser = az ad signed-in-user show --output json 2>&1
    if ($LASTEXITCODE -eq 0 -and $currentUser) {
        $userInfo = $currentUser | ConvertFrom-Json
        $currentUserId = $userInfo.id
        Write-Host "Current user: $($userInfo.userPrincipalName)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "Could not get current user info" -ForegroundColor Yellow
}
Write-Host ""

$createdGroups = @()

foreach ($groupConfig in $groupsToCreate) {
    $groupName = $groupConfig.Name
    $roleName = $groupConfig.Role
    $description = $groupConfig.Description

    Write-Host "Processing: $groupName" -ForegroundColor Cyan
    Write-Host "  Role: $roleName" -ForegroundColor Gray

    # Check if group exists
    $existingGroup = az ad group list `
        --display-name $groupName `
        --output json 2>&1 | ConvertFrom-Json

    $groupId = $null

    if ($existingGroup -and $existingGroup.Count -gt 0) {
        $groupId = $existingGroup[0].id
        Write-Host "  Group already exists (ID: $groupId)" -ForegroundColor Green
    }
    else {
        # Create group with isAssignableToRole via Microsoft Graph API
        Write-Host "  Creating security group..." -ForegroundColor Yellow

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

                $tempFile = New-TemporaryFile
                Set-Content -Path $tempFile -Value $createBody -NoNewline

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
                    Write-Host "  Group created (ID: $groupId)" -ForegroundColor Green

                    if ($groupJson.isAssignableToRole -eq $true) {
                        Write-Host "  PIM-ready (isAssignableToRole=true)" -ForegroundColor Green
                    }
                }
                else {
                    Write-Host "  Failed to create group via Graph API" -ForegroundColor Yellow
                    Write-Host "  Falling back to Azure CLI..." -ForegroundColor Yellow

                    # Fallback to CLI (won't have isAssignableToRole)
                    $newGroup = az ad group create `
                        --display-name $groupName `
                        --description $description `
                        --mail-nickname $mailNickname `
                        --output json 2>&1

                    if ($LASTEXITCODE -eq 0) {
                        $groupJson = $newGroup | ConvertFrom-Json
                        $groupId = $groupJson.id
                        Write-Host "  Group created via CLI (ID: $groupId)" -ForegroundColor Green
                        Write-Host "  Note: isAssignableToRole must be set manually in Azure Portal" -ForegroundColor Yellow
                    }
                    else {
                        Write-Host "  Failed to create group" -ForegroundColor Red
                        continue
                    }
                }
            }
        }
        catch {
            Write-Host "  Error creating group: $_" -ForegroundColor Red
            continue
        }
    }

    # Add current user as owner if we have the ID
    if ($currentUserId -and $groupId) {
        Write-Host "  Adding current user as owner..." -ForegroundColor Gray
        az ad group owner add --group $groupId --owner-object-id $currentUserId --output none 2>&1 | Out-Null
        az ad group member add --group $groupId --member-id $currentUserId --output none 2>&1 | Out-Null
    }

    # Create RBAC role assignment
    Write-Host "  Checking RBAC role assignment..." -ForegroundColor Gray
    $scope = "/subscriptions/$SubscriptionId"

    $existingAssignment = az role assignment list `
        --assignee $groupId `
        --scope $scope `
        --role $roleName `
        --output json 2>&1 | ConvertFrom-Json

    if ($existingAssignment -and $existingAssignment.Count -gt 0) {
        Write-Host "  Role assignment exists" -ForegroundColor Green
    }
    else {
        Write-Host "  Creating role assignment: $roleName..." -ForegroundColor Yellow

        $roleAssignment = az role assignment create `
            --assignee-object-id $groupId `
            --assignee-principal-type Group `
            --role $roleName `
            --scope $scope `
            --output json 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Role assignment created" -ForegroundColor Green
        }
        else {
            Write-Host "  Failed to create role assignment (may need elevated permissions)" -ForegroundColor Yellow
        }
    }

    $createdGroups += @{
        Name     = $groupName
        ObjectId = $groupId
        Role     = $roleName
    }

    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "PIM RBAC Groups Setup Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Groups created:" -ForegroundColor Cyan
foreach ($group in $createdGroups) {
    Write-Host "  $($group.Name): $($group.Role) role" -ForegroundColor Gray
}
Write-Host ""
Write-Host "To enable PIM eligibility:" -ForegroundColor Cyan
Write-Host "  1. Azure Portal > Privileged Identity Management" -ForegroundColor Gray
Write-Host "  2. Azure resources > Discover resources" -ForegroundColor Gray
Write-Host "  3. Select subscription and manage assignments" -ForegroundColor Gray
Write-Host ""

return $createdGroups
