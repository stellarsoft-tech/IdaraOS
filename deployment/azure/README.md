# IdaraOS - Azure Deployment Guide

This guide covers deploying IdaraOS to Azure Container Apps with managed PostgreSQL and Key Vault.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Azure Subscription                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐    ┌────────────────────────────────────┐  │
│  │   Shared Resources      │    │     Environment Resources          │  │
│  │   (rg-idaraos-shared)   │    │     (rg-idaraos-{env}-{loc}-001)  │  │
│  │                         │    │                                    │  │
│  │  ┌───────────────────┐  │    │  ┌──────────────────────────────┐ │  │
│  │  │ Container Registry│  │    │  │  Container Apps Environment  │ │  │
│  │  │ (cridaraos)       │──┼────┼─▶│  (cae-idaraos-{env})        │ │  │
│  │  └───────────────────┘  │    │  │                              │ │  │
│  │                         │    │  │  ┌────────────────────────┐  │ │  │
│  └─────────────────────────┘    │  │  │   Container App        │  │ │  │
│                                 │  │  │   (idaraos-{env})      │  │ │  │
│                                 │  │  └────────────────────────┘  │ │  │
│                                 │  └──────────────────────────────┘ │  │
│                                 │                                    │  │
│                                 │  ┌──────────────────────────────┐ │  │
│                                 │  │  PostgreSQL Flexible Server  │ │  │
│                                 │  │  (psql-idaraos-{env}-...)   │ │  │
│                                 │  └──────────────────────────────┘ │  │
│                                 │                                    │  │
│                                 │  ┌──────────────────────────────┐ │  │
│                                 │  │  Key Vault                   │ │  │
│                                 │  │  (kv-idaraos-{env}-001)     │ │  │
│                                 │  └──────────────────────────────┘ │  │
│                                 └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Azure CLI** installed and logged in
   ```bash
   az login
   ```

2. **Azure Subscription** with Owner or Contributor role

3. **GitHub Repository** with Actions enabled

## Quick Start

### 1. Initialize Infrastructure

Run the infrastructure setup script for each environment:

```powershell
# Development environment
./scripts/init-infrastructure.ps1 `
    -EnvironmentName "dev" `
    -Location "uks" `
    -Sequence "001" `
    -Owner "your.email@company.com"

# Staging environment
./scripts/init-infrastructure.ps1 `
    -EnvironmentName "staging" `
    -Location "uks" `
    -Sequence "001" `
    -Owner "your.email@company.com"

# Production environment (with PIM)
./scripts/init-infrastructure.ps1 `
    -EnvironmentName "prod" `
    -Location "uks" `
    -Sequence "001" `
    -Owner "your.email@company.com" `
    -EnablePim
```

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret | Description | How to Get |
|--------|-------------|------------|
| `AZURE_CLIENT_ID` | Azure AD App Registration Client ID | Create in Azure Portal |
| `AZURE_TENANT_ID` | Azure AD Tenant ID | `az account show --query tenantId` |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | `az account show --query id` |
| `ACR_NAME` | Container Registry name (without .azurecr.io) | e.g., `cridaraos` |

### 3. Configure GitHub OIDC Authentication

Create a federated credential for passwordless GitHub Actions authentication:

```bash
# Get your GitHub org/repo
GITHUB_ORG="your-org"
GITHUB_REPO="your-repo"

# Create App Registration
APP_ID=$(az ad app create --display-name "idaraos-github-deploy" --query appId -o tsv)

# Create Service Principal
az ad sp create --id $APP_ID

# Add federated credential for main branch
az ad app federated-credential create --id $APP_ID --parameters '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
}'

# Add federated credential for environments
for ENV in dev staging production; do
    az ad app federated-credential create --id $APP_ID --parameters '{
        "name": "github-env-'$ENV'",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:'$GITHUB_ORG'/'$GITHUB_REPO':environment:'$ENV'",
        "audiences": ["api://AzureADTokenExchange"]
    }'
done

# Grant Contributor role on subscription
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create \
    --assignee $APP_ID \
    --role "Contributor" \
    --scope "/subscriptions/$SUBSCRIPTION_ID"

# Grant AcrPush role on Container Registry
az role assignment create \
    --assignee $APP_ID \
    --role "AcrPush" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-idaraos-shared/providers/Microsoft.ContainerRegistry/registries/cridaraos"

# Grant Key Vault Secrets User role
for ENV in dev staging prod; do
    az role assignment create \
        --assignee $APP_ID \
        --role "Key Vault Secrets User" \
        --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-idaraos-$ENV-uks-001/providers/Microsoft.KeyVault/vaults/kv-idaraos-$ENV-001"
done

echo "AZURE_CLIENT_ID=$APP_ID"
```

### 4. Deploy

Push to main branch to trigger automatic deployment to dev:

```bash
git push origin main
```

Or manually deploy to staging/prod via GitHub Actions UI:
1. Go to Actions tab
2. Select "Deploy to Azure" workflow
3. Click "Run workflow"
4. Select environment

## Scripts Reference

### init-infrastructure.ps1

Creates all Azure resources for an environment.

**Parameters:**
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-EnvironmentName` | Yes | - | Environment: dev, staging, prod |
| `-Location` | Yes | - | Azure region code (uks, eus, weu) |
| `-Sequence` | Yes | - | Sequence number (001, 002) |
| `-Owner` | Yes | - | Owner email for tags |
| `-SubscriptionName` | No | sub_{env}_idaraos | Azure subscription name |
| `-SharedSubscriptionName` | No | sub_shared_idaraos | Shared resources subscription |
| `-EnablePim` | No | false | Create PIM RBAC groups |
| `-ValidateOnly` | No | false | Dry-run mode |
| `-AppName` | No | idaraos | Application name prefix |

### create-pim-rbac-groups.ps1

Creates PIM-enabled security groups for Just-In-Time access.

**Groups Created:**
- `{app}_{env}_Reader` - Reader role
- `{app}_{env}_Contributor` - Contributor role
- `{app}_{env}_Admin` - Owner role

### deploy-aca-service.ps1

Builds and deploys the Docker image to Container Apps.

**Parameters:**
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-EnvironmentName` | Yes | - | Target environment |
| `-Location` | Yes | - | Azure region code |
| `-Sequence` | Yes | - | Sequence number |
| `-ImageTag` | No | git SHA | Docker image tag |
| `-SkipBuild` | No | false | Use existing image |

## Resource Naming Convention

The script prompts for an application name (default: `idaraos`) and generates resource names:

| Resource | Pattern | Example |
|----------|---------|---------|
| Shared RG | `rg-{app}-shared` | rg-idaraos-shared |
| Environment RG | `rg-{app}-{env}-{loc}-{seq}` | rg-idaraos-dev-uks-001 |
| Container Registry | `cr{app}` | cridaraos |
| Container App Env | `cae-{app}-{env}` | cae-idaraos-dev |
| Container App | `{app}-{env}` | idaraos-dev |
| PostgreSQL | `psql-{app}-{env}-{loc}-{seq}` | psql-idaraos-dev-uks-001 |
| Key Vault | `kv-{app}-{env}-{seq}` | kv-idaraos-dev-001 |
| Log Analytics | `log-{app}-{env}` | log-idaraos-dev |

## Security Features

### Secrets Management
- All secrets stored in Azure Key Vault
- Secrets retrieved at deployment time
- No secrets in GitHub repository

### Network Security
- **Dev/Staging**: PostgreSQL allows Azure services
- **Production**: PostgreSQL private endpoints only

### Access Control
- Azure RBAC for all resources
- Optional PIM for Just-In-Time elevated access
- GitHub OIDC (no stored credentials)

## Troubleshooting

### Container App not starting
```bash
# Check logs
az containerapp logs show \
    --name idaraos-dev \
    --resource-group rg-idaraos-dev-uks-001 \
    --follow

# Check revision status
az containerapp revision list \
    --name idaraos-dev \
    --resource-group rg-idaraos-dev-uks-001 \
    --output table
```

### Database connection issues
```bash
# Test connectivity from Cloud Shell
az postgres flexible-server execute \
    --name psql-idaraos-dev-uks-001 \
    --admin-user pgadmin \
    --admin-password <password> \
    --database-name idaraos \
    --querytext "SELECT 1"
```

### GitHub Actions failures
1. Verify OIDC credentials are correct
2. Check role assignments on subscription and resources
3. Ensure Key Vault access policies are set

## Cost Estimation

| Resource | Dev | Staging | Prod |
|----------|-----|---------|------|
| Container Apps | ~$15/mo | ~$20/mo | ~$50/mo |
| PostgreSQL (B1ms) | ~$15/mo | ~$15/mo | ~$30/mo |
| Container Registry (Basic) | ~$5/mo | - | - |
| Key Vault | ~$1/mo | ~$1/mo | ~$1/mo |
| Log Analytics | ~$5/mo | ~$5/mo | ~$10/mo |
| **Total** | **~$40/mo** | **~$40/mo** | **~$90/mo** |

*Estimates based on minimal usage. Actual costs may vary.*

## Support

For issues with deployment, check:
1. Azure Portal > Container Apps > Logs
2. GitHub Actions run logs
3. Azure Portal > Activity Log
