# IdaraOS Scripts

This folder contains utility scripts for setting up and managing IdaraOS.

## Scripts

### `setup-entra-sso.ps1`

PowerShell script to configure Microsoft Entra ID (Azure AD) for Single Sign-On (SSO) with IdaraOS.

#### Prerequisites

- PowerShell 7+ (recommended) or Windows PowerShell 5.1
- Azure PowerShell modules (`Az.Accounts`, `Az.Resources`)
- Azure account with permission to create App Registrations
- **Your Azure AD Tenant ID** (find it in Azure Portal → Entra ID → Overview)

#### Installing Prerequisites

```powershell
# Install Azure PowerShell modules
Install-Module -Name Az -Scope CurrentUser -Repository PSGallery -Force
```

#### Finding Your Tenant ID

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **Overview**
3. Copy the **Tenant ID** value

Or via PowerShell (if already logged in):
```powershell
(Get-AzContext).Tenant.Id
```

#### Usage

**Recommended: Specify your tenant ID explicitly:**

```powershell
.\setup-entra-sso.ps1 -TenantId "12345678-1234-1234-1234-123456789012"
```

**Production setup with custom URL:**

```powershell
.\setup-entra-sso.ps1 -TenantId "your-tenant-id" -AppName "MyCompany IdaraOS" -AppUrl "https://idaraos.mycompany.com"
```

**Using current Azure context (if already logged in to correct tenant):**

```powershell
.\setup-entra-sso.ps1
```

#### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-TenantId` | **RECOMMENDED** Azure AD tenant ID | Current context |
| `-AppName` | Display name for the app in Entra ID | `IdaraOS` |
| `-AppUrl` | Base URL where IdaraOS is hosted | `http://localhost:3000` |
| `-SubscriptionName` | Azure subscription name (not required for app registrations) | Current context |
| `-CreateSecret` | Whether to create a client secret | `$true` |
| `-SecretExpiryYears` | Years until secret expires | `2` |

#### What the Script Does

1. **Checks prerequisites** - Verifies Azure PowerShell modules are installed
2. **Authenticates** - Connects to Azure (interactive login if needed)
3. **Creates App Registration** - Creates or updates the Entra ID application
4. **Creates Service Principal** - Enables the app for enterprise use
5. **Generates Client Secret** - Creates a secure secret for authentication
6. **Configures OAuth** - Sets up redirect URIs and permissions

#### Output

The script outputs:
- **Tenant ID** - Your Azure AD tenant identifier
- **Client ID** - The application (client) ID
- **Client Secret** - The secret for authentication (shown only once!)
- **Redirect URI** - Already configured in the app
- **Portal Links** - Direct links to manage the app

The configuration is also saved to a JSON file for reference.

#### Idempotency

The script is idempotent - running it multiple times will:
- Update the existing app registration (not create duplicates)
- Create a new client secret each time (if `-CreateSecret` is `$true`)
- Update redirect URIs if the URL changed

#### After Running

1. Copy the **Tenant ID**, **Client ID**, and **Client Secret**
2. Go to IdaraOS → Settings → Integrations
3. Click "Connect Microsoft Entra ID"
4. Paste the credentials and connect

#### Troubleshooting

**"Missing required modules"**
```powershell
Install-Module -Name Az -Scope CurrentUser -Repository PSGallery -Force
```

**"No tenant ID" or "Tenant: (not available)"**
- This is the most common issue. Always provide your tenant ID:
  ```powershell
  .\setup-entra-sso.ps1 -TenantId "your-tenant-id"
  ```
- Find your tenant ID at: Azure Portal → Entra ID → Overview

**"App creation returned null"**
- Usually caused by missing tenant context
- Run with explicit tenant ID:
  ```powershell
  .\setup-entra-sso.ps1 -TenantId "your-tenant-id"
  ```
- Or re-authenticate with tenant:
  ```powershell
  Connect-AzAccount -TenantId "your-tenant-id" -AuthScope MicrosoftGraphEndpointResourceId
  ```

**"Unable to acquire token for tenant"**
- This warning can usually be ignored if another tenant works
- The script will prompt you to select or skip subscriptions
- App registrations don't require a subscription

**"Insufficient privileges"**
- You need at least `Application.ReadWrite.All` permission in Azure AD
- Contact your Azure admin if you can't create app registrations

**"No Azure context found"**
- The script will prompt for interactive login
- Use the `-TenantId` parameter for best results

**"Authentication failed for Microsoft Graph API"**
- Run with Graph scope:
  ```powershell
  Connect-AzAccount -TenantId "your-tenant-id" -AuthScope MicrosoftGraphEndpointResourceId
  ```
- Then run the script again

---

## Adding New Scripts

When adding new scripts to this folder:

1. Use descriptive file names
2. Include comment-based help (`<# .SYNOPSIS ... #>`)
3. Make scripts idempotent when possible
4. Document parameters and examples
5. Update this README
