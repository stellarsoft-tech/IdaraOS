import { NewRolloutForm } from "@/components/docs/new-rollout-form"

interface NewDocumentRolloutPageProps {
  params: Promise<{ slug: string }>
}

export default async function NewDocumentRolloutPage({
  params,
}: NewDocumentRolloutPageProps) {
  const { slug } = await params

  return (
    <NewRolloutForm
      initialDocumentSlug={slug}
      backHref={`/docs/documents/${slug}`}
    />
  )
}
