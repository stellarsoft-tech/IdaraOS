"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Grid } from "./grid";
import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";

export function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd send this to your backend
    console.log("Contact request:", email);
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-24">
      <div className="mx-auto max-w-screen-xl px-4 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-neutral-50">
          {/* Grid Background */}
          <Grid
            cellSize={80}
            patternOffset={[1, -20]}
            className="inset-[unset] left-1/2 top-0 w-[1200px] -translate-x-1/2 text-neutral-200 [mask-image:linear-gradient(black_50%,transparent)]"
          />

          {/* Gradient blur */}
          <div className="absolute -left-1/4 -top-1/2 h-[135%] w-[150%] opacity-10 blur-[130px] [transform:translate3d(0,0,0)]">
            <div className="size-full bg-[conic-gradient(from_-66deg,#10b981_-32deg,#3b82f6_63deg,#f59e0b_158deg,#22c55e_240deg,#10b981_328deg,#3b82f6_423deg)] [mask-image:radial-gradient(closest-side,black_100%,transparent_100%)]" />
          </div>

          <div className="relative px-8 py-16 text-center sm:px-12 sm:py-24">
            {/* Header */}
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
                Ready to simplify your
                <br />
                <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                  compliance journey?
                </span>
              </h2>
              <p className="mt-6 text-lg text-neutral-600">
                Get in touch with us to learn how IdaraOS can help your
                organization achieve and maintain compliance with ease.
              </p>
            </div>

            {/* Contact Form */}
            <div className="mx-auto mt-10 max-w-md">
              {submitted ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100">
                    <MessageCircle className="size-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-900">
                    Thank you!
                  </h3>
                  <p className="mt-2 text-emerald-700">
                    We&apos;ve received your request and will be in touch
                    shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your work email"
                      required
                      className={cn(
                        "h-14 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-4",
                        "text-neutral-900 placeholder:text-neutral-400",
                        "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                        "transition-all duration-200",
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="group h-14 w-full gap-2 bg-neutral-900 text-base text-white hover:bg-neutral-800"
                  >
                    Contact Us
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </form>
              )}

              <p className="mt-4 text-sm text-neutral-500">
                Or email us directly at{" "}
                <a
                  href="mailto:hello@idaraos.com"
                  className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                >
                  hello@idaraos.com
                </a>
              </p>
            </div>

            {/* Trust badges */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
              {["SOC 2 Type II", "ISO 27001", "GDPR", "HIPAA"].map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-500"
                >
                  <div className="size-2 rounded-full bg-emerald-500" />
                  {badge} Ready
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
