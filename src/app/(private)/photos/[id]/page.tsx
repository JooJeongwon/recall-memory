import { PhotoView } from "@/features/revisit/photo-view";
export const dynamic = "force-dynamic";
export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhotoView id={id} />;
}
