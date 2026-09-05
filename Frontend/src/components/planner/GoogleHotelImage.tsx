"use client";

import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/api/client";
import { fallbackImage } from "@/lib/utils/format";

type Photo = { photo_url: string | null; authors: { name: string; url?: string }[]; maps_url?: string };
const safeLink = (value?: string) => value?.startsWith("https://") ? value : undefined;

export function GoogleHotelImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [state, setState] = useState("idle");
  const container = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || started.current) return;
      started.current = true;
      observer.disconnect();
      setState("loading");
      request<Photo>(src, { cache: "no-store" }).then((result) => {
        setPhoto(result);
        setState(result.photo_url ? "loaded" : "unavailable");
      }).catch(() => setState("unavailable"));
    }, { rootMargin: "100px" });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [src]);
  return (
    <div ref={container} className="relative h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo?.photo_url || fallbackImage(alt, "hotel")} alt={photo?.photo_url ? alt : "Hotel photo not loaded"} className={className} referrerPolicy="no-referrer" onError={() => { setPhoto(null); setState("unavailable"); }} />
      <div className="absolute inset-x-0 bottom-0 bg-white/95 px-2 py-1 text-xs text-slate-800">
        <span className="font-semibold">Google Maps</span>
        {state === "idle" || state === "loading" ? <span className="ml-2">Loading photo…</span> : null}
        {state === "unavailable" ? <span className="ml-2">Photo unavailable</span> : null}
        {photo?.photo_url ? <>
          {photo.authors.map((author, i) => <a className="ml-2 underline" key={i} href={safeLink(author.url)} target="_blank" rel="noreferrer">{author.name}</a>)}
          <a className="ml-2 underline" href={safeLink(photo.maps_url)} target="_blank" rel="noreferrer">View on Google Maps</a>
        </> : null}
      </div>
    </div>
  );
}
