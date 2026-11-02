-- Visual Studio workloads the IdaraOS Agent installs with an approved Visual Studio (--add <id>)
ALTER TABLE "security_software_catalog" ADD COLUMN IF NOT EXISTS "vs_workloads" text[] DEFAULT '{}'::text[] NOT NULL;
