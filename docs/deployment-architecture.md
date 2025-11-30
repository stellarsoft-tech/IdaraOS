# IdaraOS Deployment Architecture

## Infrastructure & Deployment Flow

```mermaid
flowchart TB
    subgraph ONE_TIME["🔧 ONE-TIME SETUP (Manual)"]
        direction TB
        INIT["init-infrastructure.ps1"]
        OIDC["setup-github-oidc.ps1"]
        
        INIT --> |Creates| SHARED_RG["Shared Resource Group"]
        INIT --> |Creates| ENV_RG["Environment Resource Group"]
        SHARED_RG --> ACR["Container Registry"]
        ENV_RG --> PSQL["PostgreSQL Server"]
        ENV_RG --> KV["Key Vault"]
        ENV_RG --> CAE["Container Apps Environment"]
        ENV_RG --> LOG["Log Analytics"]
        
        OIDC --> |Creates| APP_REG["Azure AD App Registration"]
        APP_REG --> |Federated Credentials| FED["GitHub OIDC Trust"]
        APP_REG --> |RBAC| ROLES["Contributor + AcrPush + KV Reader"]
    end

    subgraph GITHUB["🐙 GITHUB"]
        direction TB
        REPO["Repository"]
        SECRETS["Secrets<br/>AZURE_CLIENT_ID<br/>AZURE_TENANT_ID<br/>AZURE_SUBSCRIPTION_ID<br/>ACR_NAME"]
        ENVS["Environments<br/>dev / staging / production"]
        WORKFLOW["deploy-azure.yml"]
        
        REPO --> SECRETS
        REPO --> ENVS
        REPO --> WORKFLOW
    end

    subgraph AZURE["☁️ AZURE INFRASTRUCTURE"]
        direction TB
        
        subgraph SHARED["Shared (rg-idaraos-shared)"]
            ACR2["Container Registry<br/>cridaraos.azurecr.io"]
        end
        
        subgraph DEV["Dev (rg-idaraos-dev-uks-001)"]
            CAE_DEV["Container Apps Env"]
            CA_DEV["Container App<br/>idaraos-dev"]
            PSQL_DEV["PostgreSQL<br/>psql-idaraos-dev..."]
            KV_DEV["Key Vault<br/>kv-idaraos-dev-001"]
            LOG_DEV["Log Analytics"]
        end
        
        subgraph STAGING["Staging (rg-idaraos-staging-uks-001)"]
            CAE_STG["Container Apps Env"]
            CA_STG["Container App<br/>idaraos-staging"]
            PSQL_STG["PostgreSQL"]
            KV_STG["Key Vault"]
        end
        
        subgraph PROD["Production (rg-idaraos-prod-uks-001)"]
            CAE_PRD["Container Apps Env"]
            CA_PRD["Container App<br/>idaraos-prod"]
            PSQL_PRD["PostgreSQL"]
            KV_PRD["Key Vault"]
        end
    end

    FED -.-> |"OIDC Token Exchange"| WORKFLOW
    WORKFLOW --> |"Push Image"| ACR2
    ACR2 --> |"Pull Image"| CA_DEV
    ACR2 --> |"Pull Image"| CA_STG
    ACR2 --> |"Pull Image"| CA_PRD
```

## Deployment Pipeline Flow

```mermaid
sequenceDiagram
    autonumber
    participant DEV as Developer
    participant GH as GitHub
    participant GHA as GitHub Actions
    participant AAD as Azure AD
    participant ACR as Container Registry
    participant KV as Key Vault
    participant CA as Container App
    participant PSQL as PostgreSQL

    DEV->>GH: Push to main / Manual trigger
    GH->>GHA: Trigger workflow
    
    rect rgb(240, 248, 255)
        Note over GHA,AAD: OIDC Authentication (No secrets stored)
        GHA->>AAD: Request token (federated credential)
        AAD->>GHA: Return access token
    end
    
    rect rgb(255, 248, 240)
        Note over GHA,ACR: Build & Push
        GHA->>GHA: Docker build
        GHA->>ACR: Push image (sha + env-latest)
    end
    
    rect rgb(240, 255, 240)
        Note over GHA,KV: Fetch Secrets
        GHA->>KV: Get jwt-secret
        GHA->>KV: Get encryption-key
        GHA->>KV: Get pg-password
    end
    
    rect rgb(255, 240, 255)
        Note over GHA,CA: Deploy Container
        GHA->>CA: Create/Update Container App
        CA->>ACR: Pull image
        CA->>PSQL: Connect (DATABASE_URL)
    end
    
    CA-->>DEV: App live at https://...azurecontainerapps.io
```

## Database Handling

```mermaid
flowchart LR
    subgraph PROVISIONING["Infrastructure Setup (One-time)"]
        SCRIPT["init-infrastructure.ps1"]
        SCRIPT --> |"Creates"| PSQL["PostgreSQL Server"]
        SCRIPT --> |"Creates"| DB["Database: idaraos"]
        SCRIPT --> |"Stores"| KV["Key Vault<br/>pg-password"]
    end

    subgraph DEPLOYMENT["Each Deployment"]
        GHA["GitHub Actions"]
        GHA --> |"Reads"| KV2["Key Vault"]
        KV2 --> |"pg-password"| CONN["DATABASE_URL<br/>postgresql://pgadmin:***@psql-..."]
        CONN --> |"Env Var"| CA["Container App"]
    end

    subgraph RUNTIME["Runtime"]
        APP["Next.js App"]
        APP --> |"Prisma ORM"| PSQL2["PostgreSQL"]
    end

    CA --> APP
    PSQL --> PSQL2
```

## Key Points

| Aspect | How It Works |
|--------|--------------|
| **Auth** | OIDC federation - no secrets stored in GitHub |
| **Database** | Pre-provisioned PostgreSQL, app connects via `DATABASE_URL` |
| **Secrets** | Stored in Key Vault, fetched at deploy time |
| **Images** | Pushed to shared ACR, tagged with SHA + environment |
| **Scaling** | Container Apps auto-scale (1-3 dev, 2-10 prod) |
| **Migrations** | Run via Prisma on app startup (not in pipeline) |
