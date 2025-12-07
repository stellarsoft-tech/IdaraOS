# GDPR Compliance Plan

IdaraOS is committed to protecting personal data and ensuring compliance with the General Data Protection Regulation (EU) 2016/679 (GDPR). This document outlines our current compliance status, identifies gaps, and provides an implementation roadmap for achieving full compliance.

---

## Table of Contents

1. [Overview](#overview)
2. [Personal Data Inventory](#personal-data-inventory)
3. [Lawful Basis for Processing](#lawful-basis-for-processing)
4. [Data Subject Rights](#data-subject-rights)
5. [Technical and Organizational Measures](#technical-and-organizational-measures)
6. [Data Transfers](#data-transfers)
7. [Gap Analysis](#gap-analysis)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Compliance Checklist](#compliance-checklist)

---

## Overview

### What is GDPR?

The General Data Protection Regulation (GDPR) is a comprehensive data protection law that governs how organizations collect, process, store, and share personal data of individuals in the European Union. It applies to:

- Organizations established in the EU
- Organizations outside the EU that offer goods/services to EU residents
- Organizations that monitor the behavior of EU residents

### IdaraOS Context

IdaraOS is a multi-tenant organizational management platform that processes personal data of:

- **System Users**: Administrators and employees who access the platform
- **People Directory Entries**: Employee/contractor records managed within organizations
- **Asset Assignments**: Records linking assets to individuals

As a B2B SaaS platform, IdaraOS acts as a **Data Processor** on behalf of customer organizations (Data Controllers).

---

## Personal Data Inventory

### Article 30 - Records of Processing Activities

The following tables document all personal data processed by IdaraOS.

### 1. System Users (`core_users`)

| Field | Data Type | PII Category | Purpose | Retention |
|-------|-----------|--------------|---------|-----------|
| `id` | UUID | Identifier | Primary key | Account lifetime |
| `email` | Text | Contact | Authentication, notifications | Account lifetime |
| `name` | Text | Identity | Display name | Account lifetime |
| `avatar` | URL | Identity | Profile picture | Account lifetime |
| `passwordHash` | Text | Credential | Local authentication | Account lifetime |
| `entraId` | Text | Identifier | SSO linking | Account lifetime |
| `lastLoginAt` | Timestamp | Behavioral | Security auditing | Account lifetime |
| `invitedAt` | Timestamp | Administrative | Onboarding tracking | Account lifetime |

**Source File**: `apps/web/lib/db/schema/users.ts`

### 2. People Directory (`people_persons`)

| Field | Data Type | PII Category | Purpose | Retention |
|-------|-----------|--------------|---------|-----------|
| `id` | UUID | Identifier | Primary key | Record lifetime |
| `name` | Text | Identity | Employee name | Record lifetime |
| `email` | Text | Contact | Communication | Record lifetime |
| `phone` | Text | Contact | Communication | Record lifetime |
| `role` | Text | Employment | Job function | Record lifetime |
| `team` | Text | Employment | Department/team | Record lifetime |
| `location` | Text | Location | Office location | Record lifetime |
| `avatar` | URL | Identity | Profile picture | Record lifetime |
| `bio` | Text | Identity | Biography | Record lifetime |
| `startDate` | Date | Employment | Employment start | Record lifetime |
| `endDate` | Date | Employment | Employment end | Record lifetime |
| `hireDate` | Date | Employment | Official hire date | Record lifetime |
| `managerId` | UUID | Employment | Reporting structure | Record lifetime |
| `entraId` | Text | Identifier | SSO linking | Record lifetime |
| `lastSignInAt` | Timestamp | Behavioral | Activity tracking | Record lifetime |
| `lastPasswordChangeAt` | Timestamp | Security | Password hygiene | Record lifetime |

**Source File**: `apps/web/lib/db/schema/people.ts`

### 3. Audit Logs (`audit_logs`)

| Field | Data Type | PII Category | Purpose | Retention |
|-------|-----------|--------------|---------|-----------|
| `actorId` | UUID | Identifier | Who performed action | Indefinite* |
| `actorEmail` | Text | Contact | Historical actor reference | Indefinite* |
| `actorName` | Text | Identity | Historical actor reference | Indefinite* |
| `actorIp` | Text | Network | Security investigation | Indefinite* |
| `actorUserAgent` | Text | Technical | Device identification | Indefinite* |
| `previousValues` | JSONB | Variable | Change tracking | Indefinite* |
| `newValues` | JSONB | Variable | Change tracking | Indefinite* |

*Note: Audit log retention is currently indefinite and requires policy implementation.

**Source File**: `apps/web/lib/db/schema/audit.ts`

### 4. Asset Assignments (`assets_assignments`)

| Field | Data Type | PII Category | Purpose | Retention |
|-------|-----------|--------------|---------|-----------|
| `personId` | UUID | Identifier | Asset custodian | Assignment lifetime |
| `assignedById` | UUID | Identifier | Assigning administrator | Assignment lifetime |
| `notes` | Text | Variable | Assignment context | Assignment lifetime |

**Source File**: `apps/web/lib/db/schema/assets.ts`

### 5. Integration Data (`core_integrations`)

| Field | Data Type | PII Category | Purpose | Retention |
|-------|-----------|--------------|---------|-----------|
| `tenantId` | Text | Technical | Entra ID tenant | Integration lifetime |
| `clientId` | Text | Technical | OAuth client | Integration lifetime |
| `clientSecretEncrypted` | Text | Credential | OAuth secret (encrypted) | Integration lifetime |
| `scimTokenEncrypted` | Text | Credential | SCIM token (encrypted) | Integration lifetime |

**Source File**: `apps/web/lib/db/schema/integrations.ts`

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Data Sources                         │
├─────────────────────────────────────────────────────────────────┤
│  Microsoft Entra ID ──────┬──────────────────────────────────── │
│  (SSO + SCIM)            │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    IdaraOS Application                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  core_users  ◄──── Authentication ────► Session/JWT     │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  people_persons ◄─── SCIM Sync ───► Entra ID Groups     │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  assets_assignments ◄─► Asset Management                │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  audit_logs ◄───────── All Operations ──────────────────│   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lawful Basis for Processing

### Article 6 - Lawfulness of Processing

| Data Category | Lawful Basis | Justification |
|---------------|--------------|---------------|
| User Authentication | Contract (Art. 6(1)(b)) | Necessary for service delivery |
| People Directory | Legitimate Interest (Art. 6(1)(f)) | Organizational management |
| Audit Logs | Legal Obligation (Art. 6(1)(c)) | Security and compliance requirements |
| Asset Assignments | Contract (Art. 6(1)(b)) | Asset management service |
| Usage Analytics | Legitimate Interest (Art. 6(1)(f)) | Service improvement |

### Special Categories (Article 9)

IdaraOS does **not** intentionally collect special category data (health, biometric, political opinions, etc.). However, free-text fields (bio, notes) could contain such data. Organizations should implement policies to prevent sensitive data entry in these fields.

---

## Data Subject Rights

### Current Implementation Status

| Right | Article | Status | Implementation Details |
|-------|---------|--------|------------------------|
| **Information** | Art. 13-14 | Partial | Privacy notices not integrated in-app |
| **Access** | Art. 15 | Partial | Audit log export exists; full data export missing |
| **Rectification** | Art. 16 | Yes | User/Person update APIs available |
| **Erasure** | Art. 17 | Partial | Delete exists; audit log anonymization missing |
| **Restriction** | Art. 18 | No | No processing restriction mechanism |
| **Portability** | Art. 20 | No | No machine-readable export format |
| **Objection** | Art. 21 | No | No objection/opt-out mechanism |
| **Automated Decisions** | Art. 22 | N/A | No automated decision-making |

### Right to Access (Article 15)

**Current State:**
- Audit log export available at `GET /api/audit/logs/export` (CSV/JSON)
- Individual user data viewable via UI
- No comprehensive personal data export

**Gap:**
- Need dedicated endpoint to export all personal data for a data subject
- Should include: user profile, person record, audit history, asset assignments

**Reference**: `apps/web/app/api/audit/logs/export/route.ts`

### Right to Rectification (Article 16)

**Current State:** ✅ Compliant
- Users can update their profile via `PUT /api/settings/users/[id]`
- Person records editable via `PUT /api/people/person/[id]`
- Changes are audit logged

**Reference**: `apps/web/app/api/settings/users/[id]/route.ts`

### Right to Erasure (Article 17)

**Current State:**
- User deletion: `DELETE /api/settings/users/[id]`
- Person deletion: `DELETE /api/people/person/[id]`
- SCIM-provisioned users use soft-delete (status = deactivated)

**Gaps:**
1. Audit logs retain personal data after deletion
2. No anonymization strategy for historical records
3. Cascading deletion incomplete (asset assignments retain references)

**Reference**: `apps/web/app/api/scim/v2/users/[id]/route.ts` (soft delete at line 288-295)

### Right to Data Portability (Article 20)

**Current State:** ❌ Not Implemented
- No machine-readable export in standard format (JSON-LD, CSV)
- No bulk export of personal data

**Required:**
- Endpoint: `GET /api/gdpr/export/[userId]`
- Format: JSON with all personal data
- Include: User, Person, Audit history, Asset assignments

### Right to Restriction of Processing (Article 18)

**Current State:** ❌ Not Implemented
- No flag to mark data as "restricted"
- No mechanism to prevent processing while retaining data

**Required:**
- Add `processingRestricted` boolean to users table
- Prevent data modification when flag is true
- Allow data controllers to set restriction

### Right to Object (Article 21)

**Current State:** ❌ Not Implemented
- No opt-out mechanism for legitimate interest processing
- No objection tracking

**Required:**
- Add objection tracking for marketing/analytics
- Respect objections in data processing flows

---

## Technical and Organizational Measures

### Article 32 - Security of Processing

#### Encryption

| Measure | Status | Implementation |
|---------|--------|----------------|
| Encryption at Rest | ✅ | AES-256-CBC for secrets |
| Encryption in Transit | ✅ | HTTPS enforced via Caddy |
| Key Management | ✅ | Environment-based key storage |

**Implementation Details:**

```typescript
// apps/web/lib/encryption.ts
const ALGORITHM = "aes-256-cbc"
// Secrets encrypted before database storage
// Key derived using scrypt with salt
```

**Reference**: `apps/web/lib/encryption.ts`

#### Access Control

| Measure | Status | Implementation |
|---------|--------|----------------|
| Role-Based Access | ✅ | RBAC with granular permissions |
| Multi-Tenant Isolation | ✅ | All queries scoped by `orgId` |
| SSO Integration | ✅ | Microsoft Entra ID (OIDC) |
| MFA | ⏳ | Delegated to identity provider |

**Reference**: `apps/web/lib/rbac/`

#### Audit Logging

| Measure | Status | Implementation |
|---------|--------|----------------|
| Action Logging | ✅ | All CRUD operations logged |
| Actor Tracking | ✅ | User, IP, User Agent captured |
| Sensitive Data Masking | ✅ | Passwords, tokens redacted |
| Tamper Protection | ❌ | Logs mutable (not append-only) |

**Sensitive Fields Masked:**

```typescript
// apps/web/lib/audit/types.ts
export const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "secret",
  "clientSecret",
  "accessToken",
  "refreshToken",
  "apiKey",
  "token",
  "scimToken",
  "encryptionKey",
  "privateKey",
]
```

**Reference**: `apps/web/lib/audit/sanitize.ts`

#### Database Security

| Measure | Status | Implementation |
|---------|--------|----------------|
| Parameterized Queries | ✅ | Drizzle ORM prevents SQL injection |
| Connection Security | ✅ | SSL for database connections |
| Backup Encryption | ⏳ | Depends on hosting provider |

---

## Data Transfers

### Article 44-49 - International Transfers

#### Current Data Flows

| Destination | Purpose | Safeguard |
|-------------|---------|-----------|
| Microsoft Entra ID | SSO/SCIM | Data Processing Agreement |
| Azure Cloud (EU) | Hosting | SCCs + Microsoft DPA |

#### Third-Party Sub-Processors

| Sub-Processor | Service | Data Accessed |
|---------------|---------|---------------|
| Microsoft Azure | Cloud Infrastructure | All data |
| Microsoft Entra ID | Identity Provider | User identifiers |

**Note:** Organizations deploying IdaraOS should ensure their hosting region aligns with data residency requirements.

---

## Gap Analysis

### Critical Gaps (Must Fix)

| Gap | GDPR Article | Risk Level | Effort |
|-----|--------------|------------|--------|
| No Data Subject Export API | Art. 15, 20 | High | Medium |
| Audit Logs Not Anonymized on Deletion | Art. 17 | High | Medium |
| No Privacy Policy Integration | Art. 13-14 | Medium | Low |
| No Retention Policy Configuration | Art. 5(1)(e) | Medium | Medium |

### Moderate Gaps (Should Fix)

| Gap | GDPR Article | Risk Level | Effort |
|-----|--------------|------------|--------|
| No Processing Restriction Flag | Art. 18 | Medium | Low |
| No Consent Tracking | Art. 7 | Medium | Medium |
| No Breach Notification System | Art. 33-34 | Medium | High |
| No DPO Contact Configuration | Art. 37-39 | Low | Low |

### Low Priority Gaps

| Gap | GDPR Article | Risk Level | Effort |
|-----|--------------|------------|--------|
| No Objection Tracking | Art. 21 | Low | Low |
| Audit Logs Not Append-Only | Art. 32 | Low | High |
| No Data Minimization Review | Art. 5(1)(c) | Low | Medium |

---

## Implementation Roadmap

### Phase 1: Critical Compliance (Q1)

#### 1.1 Data Subject Export API

**Objective:** Enable data subjects to export all their personal data

**Implementation:**

```typescript
// New endpoint: GET /api/gdpr/export/[userId]
// Returns JSON with:
{
  "exportDate": "ISO timestamp",
  "dataSubject": {
    "user": { /* user record */ },
    "person": { /* person record if linked */ },
    "assetAssignments": [ /* current assignments */ ],
    "auditHistory": [ /* actions performed by/on user */ ]
  }
}
```

**Tasks:**
- [ ] Create `apps/web/app/api/gdpr/export/[userId]/route.ts`
- [ ] Aggregate data from users, persons, assets_assignments, audit_logs
- [ ] Add permission check (user can export own data, admin can export any)
- [ ] Support JSON and CSV formats
- [ ] Add rate limiting to prevent abuse

#### 1.2 Erasure with Anonymization

**Objective:** Properly handle right to erasure including audit log anonymization

**Implementation:**

```typescript
// Enhanced deletion flow:
// 1. Delete user record
// 2. Delete linked person record (if configured)
// 3. Anonymize audit logs:
//    - Replace actorEmail with "[DELETED USER]"
//    - Replace actorName with null
//    - Replace actorIp with null
//    - Keep action/entity data for compliance
```

**Tasks:**
- [ ] Add `anonymizeUserInAuditLogs(userId)` function
- [ ] Update user deletion API to call anonymization
- [ ] Add organization setting: `retainAnonymizedAuditLogs: boolean`
- [ ] Document in admin UI

#### 1.3 Privacy Policy Integration

**Objective:** Display privacy notices to users

**Tasks:**
- [ ] Add `privacyPolicyUrl` to organizations table
- [ ] Add `termsOfServiceUrl` to organizations table
- [ ] Display links in footer and login page
- [ ] Track acceptance timestamp for users

### Phase 2: Enhanced Compliance (Q2)

#### 2.1 Retention Policy Configuration

**Objective:** Allow organizations to configure data retention periods

**Implementation:**

```typescript
// New organization settings:
{
  "retention": {
    "auditLogsMonths": 24,      // Default: 24 months
    "deletedUserDataDays": 30,  // Grace period before hard delete
    "sessionDataDays": 90       // Session/token cleanup
  }
}
```

**Tasks:**
- [ ] Add retention settings to organization schema
- [ ] Create retention policy UI in Settings
- [ ] Implement scheduled cleanup job
- [ ] Add audit log for retention policy changes

#### 2.2 Consent Tracking

**Objective:** Track user consent for optional processing

**Implementation:**

```sql
-- New table: gdpr_consents
CREATE TABLE gdpr_consents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES core_users(id),
  consent_type TEXT NOT NULL,  -- 'marketing', 'analytics', etc.
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Tasks:**
- [ ] Create `gdpr_consents` table
- [ ] Add consent management UI
- [ ] Create consent check middleware
- [ ] Respect consent in relevant features

#### 2.3 Processing Restriction Flag

**Objective:** Allow restricting processing without deletion

**Tasks:**
- [ ] Add `processingRestricted` boolean to users table
- [ ] Add restriction management API
- [ ] Prevent data modification when restricted
- [ ] Allow data export when restricted

### Phase 3: Advanced Compliance (Q3-Q4)

#### 3.1 Breach Notification System

**Objective:** Detect and notify of potential data breaches

**Implementation:**

- Security event monitoring (failed logins, unusual access patterns)
- Breach assessment workflow
- Notification templates for supervisory authorities
- Data subject notification mechanism

**Tasks:**
- [ ] Define breach detection criteria
- [ ] Create breach incident table
- [ ] Build assessment workflow UI
- [ ] Implement notification system
- [ ] Document 72-hour response procedure

#### 3.2 DPO Configuration

**Objective:** Allow organizations to configure DPO contact information

**Tasks:**
- [ ] Add DPO fields to organization settings
- [ ] Display DPO contact in privacy notices
- [ ] Create DPO dashboard for data requests

---

## Compliance Checklist

### Controller Obligations

- [ ] **Art. 5** - Data processing principles documented
- [ ] **Art. 6** - Lawful basis identified for all processing
- [ ] **Art. 7** - Consent mechanisms implemented (where applicable)
- [ ] **Art. 12** - Transparent communication procedures
- [ ] **Art. 13-14** - Privacy notices provided
- [ ] **Art. 15** - Subject access request process
- [ ] **Art. 16** - Rectification process
- [ ] **Art. 17** - Erasure process with anonymization
- [ ] **Art. 18** - Restriction of processing capability
- [ ] **Art. 20** - Data portability export
- [ ] **Art. 21** - Objection handling process
- [ ] **Art. 30** - Records of processing activities
- [ ] **Art. 32** - Security measures implemented
- [ ] **Art. 33-34** - Breach notification procedures

### Processor Obligations (IdaraOS as Processor)

- [x] **Art. 28** - Process only on controller instructions (via API)
- [x] **Art. 28** - Ensure confidentiality (RBAC, encryption)
- [ ] **Art. 28** - Assist with data subject requests (export API)
- [x] **Art. 28** - Delete data on termination (deletion APIs)
- [x] **Art. 28** - Make available audit information (audit logs)
- [x] **Art. 32** - Implement appropriate security measures

### Technical Measures

- [x] Encryption at rest (AES-256-CBC)
- [x] Encryption in transit (HTTPS/TLS)
- [x] Access control (RBAC)
- [x] Audit logging
- [x] Sensitive data masking
- [ ] Data minimization review
- [ ] Retention policy enforcement
- [ ] Breach detection system

---

## References

### Codebase References

| Component | Path | Purpose |
|-----------|------|---------|
| User Schema | `apps/web/lib/db/schema/users.ts` | User PII definition |
| Person Schema | `apps/web/lib/db/schema/people.ts` | Employee PII definition |
| Audit Schema | `apps/web/lib/db/schema/audit.ts` | Audit log structure |
| Encryption | `apps/web/lib/encryption.ts` | Data encryption utilities |
| Audit Sanitizer | `apps/web/lib/audit/sanitize.ts` | Sensitive field masking |
| SCIM Sync | `apps/web/lib/scim/full-sync.ts` | External data sync |
| User Deletion | `apps/web/app/api/settings/users/[id]/route.ts` | Erasure implementation |
| Audit Export | `apps/web/app/api/audit/logs/export/route.ts` | Log export endpoint |

### External References

- [GDPR Full Text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
- [ICO GDPR Guide](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/)
- [EDPB Guidelines](https://edpb.europa.eu/our-work-tools/general-guidance/gdpr-guidelines-recommendations-best-practices_en)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-07 | IdaraOS Team | Initial GDPR compliance assessment |

---

**Note:** This document should be reviewed and updated quarterly, or whenever significant changes are made to data processing activities. Organizations using IdaraOS should conduct their own Data Protection Impact Assessments (DPIAs) where required.

