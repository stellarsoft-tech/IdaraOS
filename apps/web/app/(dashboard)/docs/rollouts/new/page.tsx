import { NewRolloutForm } from "@/components/docs/new-rollout-form"

interface NewRolloutPageProps {
  searchParams: Promise<{
    document?: string
    slug?: string
  }>
}

export default async function NewRolloutPage({
  searchParams,
}: NewRolloutPageProps) {
  const params = await searchParams

  return (
    <NewRolloutForm
      initialDocumentSlug={params.document ?? params.slug}
      backHref="/docs/documents"
    />
  )
}
