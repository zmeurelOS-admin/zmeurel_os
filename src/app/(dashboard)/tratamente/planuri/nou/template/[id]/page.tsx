import { notFound } from 'next/navigation'

import { getTemplateCuLinii } from '@/app/(dashboard)/tratamente/planuri/templates/actions'
import { listParcelePentruPlanWizard } from '@/lib/supabase/queries/tratamente'

import { TemplatePreviewClient } from './TemplatePreviewClient'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function TemplatePlanPage({ params }: PageProps) {
  const { id } = await params

  try {
    const [{ template, linii }, parcele] = await Promise.all([
      getTemplateCuLinii(id),
      listParcelePentruPlanWizard('zmeur'),
    ])

    return <TemplatePreviewClient template={template} linii={linii} parcele={parcele} />
  } catch {
    notFound()
  }
}
