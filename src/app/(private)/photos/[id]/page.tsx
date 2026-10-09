import { PhotoView } from "@/features/revisit/photo-view";
import { TrialNotice } from "@/features/trial/trial-notice";
export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><h1>사진과 메모</h1><TrialNotice /><PhotoView id={id} detail /></>;
}
