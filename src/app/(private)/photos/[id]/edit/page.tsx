import { NoteEditView } from "@/features/revisit/note-edit-view";
export const dynamic = "force-dynamic";
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteEditView id={id} />;
}
