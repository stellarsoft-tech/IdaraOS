# IdaraOS

An open-source company operating system for founders and small teams: People & HR, Asset management, Finance essentials, and a full ISMS workspace (ISO/IEC 27001) with risks, controls, evidence, objectives, and audits — all in one repo.

## Core modules
- **People & HR**: directory, roles, join/exit dates, docs & onboarding.
- **Assets**: inventory, assignment history, lifecycle & warranties.
- **Finance basics**: chart of accounts (light), expenses, invoices, vendors.
- **ISMS**: risk register, controls library, SoA, evidence store, audits, CAPA, yearly objectives/plan.
- **Policies & docs**: versioned policies, approvals, attestations.
- **Workflows**: tasks, reminders, checklists; webhooks for automation.
- **Security & access**: RBAC, audit logs, SSO-ready.

## Compliance engine
- **ISO/IEC 27001:2022** mapping (Annex A – 93 controls) with SoA generation. :contentReference[oaicite:0]{index=0}  
- **Machine-readable controls**: import/export via **OSCAL** (JSON/YAML) and **OpenControl** (YAML) to interoperate with existing tooling. :contentReference[oaicite:1]{index=1}

## Architecture & extensibility
- **API-first** (REST + webhooks), modular services, plugin hooks.
- Works with any SQL database; ships with seeds and sample blueprints.

## Roadmap
- SOC 2 & NIST CSF mappings; vendor risk; evidence automations; plugin SDK.

## License
Apache-2.0 (or AGPL-3.0 if you want “open core” with SaaS fairness).
