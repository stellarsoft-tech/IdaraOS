"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Grid } from "./grid";
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  Users,
  FileCheck,
  Lock,
} from "lucide-react";

const HERO_GRADIENT = `radial-gradient(77% 116% at 37% 67%, #10b981, rgba(16, 185, 129, 0) 50%),
  radial-gradient(56% 84% at 34% 56%, #3b82f6, rgba(59, 130, 246, 0) 50%),
  radial-gradient(85% 127% at 100% 100%, #f59e0b, rgba(245, 158, 11, 0) 50%),
  radial-gradient(82% 122% at 3% 29%, #8b5cf6, rgba(139, 92, 246, 0) 50%),
  radial-gradient(90% 136% at 52% 100%, #ef4444, rgba(239, 68, 68, 0) 50%),
  radial-gradient(102% 143% at 92% 7%, #22c55e, rgba(34, 197, 94, 0) 50%)`;

export function Hero() {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-screen-xl overflow-hidden px-4 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-neutral-50 p-8 text-center sm:p-16 lg:p-20">
        {/* Grid Background */}
        <Grid
          cellSize={80}
          patternOffset={[1, -58]}
          className="inset-[unset] left-1/2 top-0 w-[1400px] -translate-x-1/2 text-neutral-300 [mask-image:linear-gradient(transparent,black_70%)]"
        />

        {/* Gradient blur */}
        <div className="absolute -inset-x-10 bottom-0 h-[60%] opacity-30 blur-[100px] [transform:translate3d(0,0,0)]">
          <div
            className="size-full -scale-y-100 [mask-image:radial-gradient(closest-side,black_100%,transparent_100%)]"
            style={{ backgroundImage: HERO_GRADIENT }}
          />
        </div>

        {/* Content */}
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center">
          {/* Logo Icon */}
          <div
            className="rounded-2xl p-px shadow-2xl shadow-emerald-500/20"
            style={{
              background:
                "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.2))",
            }}
          >
            <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600">
              <Shield className="size-10 text-white" strokeWidth={2} />
            </div>
          </div>

          {/* Badge */}
          <div
            className={cn(
              "mt-8 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700",
              "animate-slide-up-fade [--offset:10px] [animation-delay:100ms] [animation-duration:1s] [animation-fill-mode:both]",
            )}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Open Source &amp; Self-Hostable
          </div>

          {/* Headline */}
          <h1
            className={cn(
              "mt-6 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl",
              "animate-slide-up-fade [--offset:20px] [animation-duration:1s] [animation-fill-mode:both]",
            )}
          >
            Unified Compliance,
            <br />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Security &amp; Governance
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className={cn(
              "mt-6 max-w-xl text-lg text-neutral-600 sm:text-xl",
              "animate-slide-up-fade [--offset:10px] [animation-delay:200ms] [animation-duration:1s] [animation-fill-mode:both]",
            )}
          >
            The all-in-one platform for managing your organization&apos;s compliance
            frameworks, security controls, and governance workflows. Built for
            modern teams.
          </p>

          {/* CTA Buttons */}
          <div
            className={cn(
              "mt-10 flex flex-col items-center gap-4 sm:flex-row",
              "animate-slide-up-fade [--offset:5px] [animation-delay:300ms] [animation-duration:1s] [animation-fill-mode:both]",
            )}
          >
            <Link href="/login">
              <Button
                size="lg"
                className="group h-12 gap-2 bg-neutral-900 px-6 text-base text-white hover:bg-neutral-800"
              >
                Start for Free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="#contact">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
              >
                Contact Sales
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div
            className={cn(
              "mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-neutral-500",
              "animate-slide-up-fade [--offset:5px] [animation-delay:400ms] [animation-duration:1s] [animation-fill-mode:both]",
            )}
          >
            {[
              { icon: CheckCircle2, text: "SOC 2 Ready" },
              { icon: FileCheck, text: "ISO 27001 Templates" },
              { icon: Lock, text: "GDPR Compliant" },
              { icon: Users, text: "Multi-tenant" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="size-4 text-emerald-500" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* App Preview */}
        <div
          className={cn(
            "relative mx-auto mt-16 max-w-5xl",
            "animate-slide-up-fade [--offset:30px] [animation-delay:500ms] [animation-duration:1s] [animation-fill-mode:both]",
          )}
        >
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/10">
            <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-400" />
                <div className="size-3 rounded-full bg-yellow-400" />
                <div className="size-3 rounded-full bg-green-400" />
              </div>
              <div className="mx-auto flex items-center gap-2 rounded-lg bg-white px-3 py-1 text-xs text-neutral-400">
                <Lock className="size-3" />
                app.idaraos.com
              </div>
            </div>
            <div className="relative aspect-[16/9] bg-gradient-to-br from-neutral-50 to-neutral-100">
              {/* Placeholder dashboard preview */}
              <div className="absolute inset-0 flex">
                {/* Sidebar */}
                <div className="w-56 border-r border-neutral-200 bg-white p-4">
                  <div className="mb-6 flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-emerald-500" />
                    <div className="h-4 w-20 rounded bg-neutral-200" />
                  </div>
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "mb-2 flex items-center gap-3 rounded-lg px-3 py-2",
                        i === 0 && "bg-emerald-50",
                      )}
                    >
                      <div
                        className={cn(
                          "size-4 rounded",
                          i === 0 ? "bg-emerald-500" : "bg-neutral-200",
                        )}
                      />
                      <div
                        className={cn(
                          "h-3 rounded",
                          i === 0 ? "w-16 bg-emerald-200" : "w-20 bg-neutral-200",
                        )}
                      />
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div className="flex-1 p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="h-6 w-32 rounded bg-neutral-200" />
                    <div className="h-8 w-24 rounded-lg bg-emerald-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-neutral-200 bg-white p-4"
                      >
                        <div className="mb-2 h-3 w-16 rounded bg-neutral-200" />
                        <div className="h-8 w-12 rounded bg-neutral-300" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="mb-4 h-4 w-24 rounded bg-neutral-200" />
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="size-4 rounded bg-emerald-200" />
                          <div className="h-3 flex-1 rounded bg-neutral-100" />
                          <div className="h-6 w-16 rounded-full bg-emerald-100" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
