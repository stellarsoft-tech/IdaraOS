"use client";

import { cn } from "@/lib/utils";
import {
  Shield,
  Users,
  FileCheck,
  Lock,
  BarChart3,
  Settings,
  GitBranch,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Framework Management",
    description:
      "Map controls across SOC 2, ISO 27001, GDPR, HIPAA, and custom frameworks. Unified view of your compliance posture.",
    color: "emerald",
  },
  {
    icon: FileCheck,
    title: "Evidence Collection",
    description:
      "Automated evidence gathering with integrations to your existing tools. Continuous monitoring and alerting.",
    color: "blue",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description:
      "Fine-grained permissions with RBAC. SCIM provisioning and SSO support for enterprise security.",
    color: "violet",
  },
  {
    icon: Lock,
    title: "Risk Management",
    description:
      "Identify, assess, and track risks with customizable scoring. Link risks to controls and evidence.",
    color: "amber",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description:
      "Dashboards and reports that give you instant visibility into your compliance and security status.",
    color: "rose",
  },
  {
    icon: GitBranch,
    title: "Audit Workflows",
    description:
      "Streamlined audit preparation with task management, reviewer assignments, and progress tracking.",
    color: "cyan",
  },
];

const colorClasses = {
  emerald: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    border: "border-emerald-100",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    border: "border-blue-100",
  },
  violet: {
    bg: "bg-violet-50",
    icon: "text-violet-600",
    border: "border-violet-100",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "text-amber-600",
    border: "border-amber-100",
  },
  rose: {
    bg: "bg-rose-50",
    icon: "text-rose-600",
    border: "border-rose-100",
  },
  cyan: {
    bg: "bg-cyan-50",
    icon: "text-cyan-600",
    border: "border-cyan-100",
  },
};

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-screen-xl px-4 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700">
            <Zap className="size-4 text-emerald-500" />
            Powerful Features
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Everything you need for
            <br />
            <span className="text-neutral-500">compliance &amp; security</span>
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Built from the ground up to help modern organizations manage their
            compliance programs efficiently and effectively.
          </p>
        </div>

        {/* Features grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description, color }) => {
            const colors = colorClasses[color as keyof typeof colorClasses];
            return (
              <div
                key={title}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-white p-6 transition-all duration-300",
                  "hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-900/5",
                  colors.border,
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "mb-4 flex size-12 items-center justify-center rounded-xl",
                    colors.bg,
                  )}
                >
                  <Icon className={cn("size-6", colors.icon)} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-neutral-900">
                  {title}
                </h3>
                <p className="mt-2 text-neutral-600">{description}</p>

                {/* Hover gradient */}
                <div
                  className={cn(
                    "absolute -right-20 -top-20 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20",
                    colors.bg,
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom highlight */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-900 to-neutral-800 p-8 text-center sm:p-12">
          <div className="relative">
            <Settings className="mx-auto size-12 text-emerald-400" />
            <h3 className="mt-6 text-2xl font-semibold text-white sm:text-3xl">
              Fully Customizable
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-neutral-400">
              Every organization is different. IdaraOS adapts to your specific
              compliance requirements with custom frameworks, controls, and
              workflows.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
              {[
                "Custom Frameworks",
                "Flexible Workflows",
                "API Access",
                "Self-Hosted Option",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-neutral-700 bg-neutral-800 px-4 py-2 text-neutral-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
