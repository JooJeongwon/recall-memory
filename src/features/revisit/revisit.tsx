"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";
import { PhotoView } from "./photo-view";

export function Revisit() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("사진을 불러오는 중…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    requestApi<{ photos: unknown[] }>("/api/photos?limit=20").then((data) => {
      if (!active) return;
      const list = z.array(photoSchema).parse(data.photos); setPhotos(list);
      setIndex(Math.max(0, list.findIndex((p) => !p.first_viewed_at))); setMessage(list.length ? "" : "선택한 사진이 아직 없어요.");
    }).catch((e: Error) => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [retry]);
  return <><p role="status">{message}</p>{photos[index] && <><PhotoView key={photos[index].id} id={photos[index].id} />
    <div className="actions"><button data-leave className="secondary" disabled={index === 0}
      onClick={() => setIndex((i) => Math.max(0, i - 1))}>이전 사진 보기</button>
      <button data-leave className="secondary" disabled={index === photos.length - 1}
        onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}>다음 사진 보기</button>
      <Link href={`/photos/${photos[index].id}`} prefetch={false}>사진 상세와 가져가기</Link></div>
    <p aria-live="polite">{index + 1}번째 사진 / {photos.length}장{index === photos.length - 1 ? " · 마지막 사진이에요." : ""}</p></>}
    {!photos.length && <div className="actions"><Link href="/start">사진 선택하기</Link><button className="secondary" onClick={() => setRetry((v) => v + 1)}>다시 불러오기</button></div>}</>;
}
