import { EntryForm } from '@/components/checklist/EntryForm'

interface EditEntryPageProps {
  params: Promise<{ id: string }>
}

export default async function EditEntryPage({ params }: EditEntryPageProps) {
  const { id } = await params
  return (
    <div className="max-w-4xl mx-auto">
      <EntryForm entryId={id} />
    </div>
  )
}
