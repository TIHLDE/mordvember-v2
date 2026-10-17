"use client";

import jsQR from "jsqr";
import { Button } from "@/components/ui";
import { useEffect, useRef, useState } from "react";

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick() {
      if (stopped) return;
      const v = video.current;
      if (v && ctx && v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (code?.data) {
          try {
            const url = new URL(code.data);
            if (url.pathname === "/api/sjekkinn" && url.searchParams.get("k")) {
              stopped = true;
              window.location.assign(new URL(`/api/sjekkinn?k=${encodeURIComponent(url.searchParams.get("k")!)}`, window.location.origin).href);
              return;
            }
          } catch {}
        }
      }
      frame = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        frame = requestAnimationFrame(tick);
      })
      .catch(() => setError("Fikk ikke tilgang til kameraet. Bruk mobilens vanlige kamera i stedet."));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className="space-y-4">
      {active ? (
        <>
          <video ref={video} playsInline muted className="aspect-square w-full max-w-sm rounded-xl bg-black object-cover" />
          <Button type="button" variant="ghost" onClick={() => setActive(false)}>
            Lukk kamera
          </Button>
        </>
      ) : (
        <Button type="button" onClick={() => setActive(true)}>
          Skann QR-koden på tavla
        </Button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
