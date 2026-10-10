"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { requestApi } from "@/lib/api";
import { photoSchema, type Photo } from "@/lib/validation/contracts";

export function MemoryList() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState("보관함을 불러오는 중…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    requestApi<{ photos: unknown[] }>("/api/photos?scope=preserved&limit=20").then((data) => {
      const list = z.array(photoSchema).parse(data.photos); setPhotos(list);
      setMessage(list.length ? "" : "다시 본 순간에 한 줄을 남기면 여기에 모여요.");
    }).catch((e: Error) => setMessage(e.message));
  }, [retry]);
  return <><p role="status">{message}</p><div className="grid">{photos.map((photo) => <article className="card" key={photo.id}>
    <MemoryThumbnail key={`${photo.id}:${retry}`} id={photo.id} />
    <Link href={`/photos/${photo.id}`} prefetch={false}>사진 열기</Link>
    <p>{photo.note_text || "메모를 비워도 사진은 보관되어 있어요."}</p>
    <time dateTime={photo.preserved_at!}>{new Date(photo.preserved_at!).toLocaleDateString("ko-KR")}</time>
  </article>)}</div><button className="secondary" onClick={() => setRetry((v) => v + 1)}>다시 불러오기</button></>;
}

function MemoryThumbnail({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  return failed ? <p>사진을 열어 확인해주세요.</p> : <img className="photo" src={`/api/photos/${id}/asset`}
    alt="보관한 사진" loading="lazy" onError={() => setFailed(true)} />;
}
