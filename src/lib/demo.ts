import type { Photo } from "@/lib/validation/contracts";

export function isDemoMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export const demoImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
  <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d8b08c"/><stop offset="1" stop-color="#536b68"/></linearGradient></defs>
  <rect width="900" height="1200" fill="url(#g)"/>
  <circle cx="690" cy="260" r="170" fill="#f7d5a4" opacity=".8"/>
  <path d="M0 930c180-210 300-150 440-280 150-140 260-40 460 180v370H0z" fill="#233c3d" opacity=".82"/>
  <path d="M0 1010c180-160 320-120 470-240 160-130 270-20 430 130v300H0z" fill="#152627" opacity=".85"/>
  <text x="64" y="1080" fill="#fff" font-family="sans-serif" font-size="34" opacity=".9">A quiet afternoon</text>
</svg>
`)}`;

export const demoImage2 = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
  <defs><linearGradient id="g2" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#1a1a2e"/><stop offset="1" stop-color="#16213e"/></linearGradient></defs>
  <rect width="900" height="1200" fill="url(#g2)"/>
  <circle cx="450" cy="380" r="220" fill="#e8c4a0" opacity=".12"/>
  <circle cx="450" cy="380" r="140" fill="#f0d4b8" opacity=".18"/>
  <circle cx="450" cy="380" r="70" fill="#fbe8d0" opacity=".55"/>
  <path d="M0 800c200-180 400-80 600-160 150-60 220 20 300 100v460H0z" fill="#0d1117" opacity=".9"/>
  <text x="64" y="1060" fill="#c9a87a" font-family="sans-serif" font-size="28" opacity=".85">이 빛이 사라지기 전에</text>
  <text x="64" y="1100" fill="#fff" font-family="sans-serif" font-size="34" opacity=".9">Golden hour</text>
</svg>
`)}`;

export const demoPhoto: Photo = {
  id: "00000000-0000-4000-8000-000000000001",
  note_text: "천천히 걷던 오후의 빛",
  second_note_text: "",
  second_note_at: null,
  version: 1,
  original_name: "demo-afternoon.svg",
  mime_type: "image/png",
  byte_size: 128000,
  ready_at: "2026-10-10T08:00:00.000Z",
  preserved_at: "2026-10-10T08:30:00.000Z",
  first_note_at: "2026-10-10T08:30:00.000Z",
  first_viewed_at: null,
};

export const demoPhoto2: Photo = {
  id: "00000000-0000-4000-8000-000000000002",
  note_text: "사라지기 직전의 황금빛",
  second_note_text: "",
  second_note_at: null,
  version: 1,
  original_name: "demo-golden.svg",
  mime_type: "image/png",
  byte_size: 128000,
  ready_at: "2026-10-10T09:00:00.000Z",
  preserved_at: "2026-10-10T09:30:00.000Z",
  first_note_at: "2026-10-10T09:30:00.000Z",
  first_viewed_at: null,
};

export const demoPhotos = [demoPhoto, demoPhoto2];
export const demoImages: Record<string, string> = {
  [demoPhoto.id]: demoImage,
  [demoPhoto2.id]: demoImage2,
};
