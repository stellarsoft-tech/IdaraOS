"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "sticky inset-x-0 top-0 z-50 w-full transition-all duration-300",
        )}
      >
        {/* Background that appears on scroll */}
        <div
          className={cn(
            "absolute inset-0 border-b border-transparent transition-all duration-300",
            scrolled && "border-neutral-200/50 bg-white/80 backdrop-blur-xl",
          )}
        />

        <div className="relative mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
              <Shield className="size-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-neutral-900">
              IdaraOS
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 md:flex">
            {[
              { name: "Features", href: "#features" },
              { name: "Security", href: "#security" },
              { name: "Pricing", href: "#pricing" },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors",
                  "hover:bg-neutral-100 hover:text-neutral-900",
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-neutral-600">
                Sign in
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="bg-neutral-900 text-white hover:bg-neutral-800"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-neutral-200 bg-white p-4 md:hidden">
          <div className="flex flex-col gap-2">
            {[
              { name: "Features", href: "#features" },
              { name: "Security", href: "#security" },
              { name: "Pricing", href: "#pricing" },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                {item.name}
              </Link>
            ))}
            <hr className="my-2 border-neutral-200" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-neutral-900 text-white hover:bg-neutral-800">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
