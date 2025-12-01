import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { CTA } from "@/components/marketing/cta";

export const metadata = {
  title: "IdaraOS - Unified Compliance, Security & Governance Platform",
  description:
    "The open-source platform for managing your organization's compliance frameworks, security controls, and governance workflows. SOC 2, ISO 27001, GDPR, and more.",
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <CTA />
    </>
  );
}
