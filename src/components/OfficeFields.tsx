"use client";

import "leaflet/dist/leaflet.css";
import type { Circle, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/styles";
import { Field } from "@/components/ui";

type Office = { lat: number; lng: number; radiusMeters: number };

const parse = (value: string) => Number(value.replace(",", "."));
const valid = (lat: number, lng: number, radius: number) =>
  Number.isFinite(lat) &&
  Math.abs(lat) <= 90 &&
  Number.isFinite(lng) &&
  Math.abs(lng) <= 180 &&
  Number.isFinite(radius) &&
  radius > 0;

// Lat/lng/radius inputs with a map of the check-in area. Clicking the map moves the centre.
export function OfficeFields({ office }: { office: Office }) {
  const [lat, setLat] = useState(String(office.lat));
  const [lng, setLng] = useState(String(office.lng));
  const [radius, setRadius] = useState(String(office.radiusMeters));
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const circle = useRef<Circle | null>(null);

  // Leaflet needs `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        const m = L.map(container.current, { scrollWheelZoom: false }).setView(
          [office.lat, office.lng],
          15,
        );
        // OpenStreetMap's free tiles. Their usage policy asks for a Referer, which the app's same-origin policy would strip.
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          referrerPolicy: "strict-origin-when-cross-origin",
          className: "map-dark",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(m);
        circle.current = L.circle([office.lat, office.lng], {
          radius: office.radiusMeters,
          color: "#ef4444",
          weight: 2,
          fillColor: "#b3121b",
          fillOpacity: 0.25,
        }).addTo(m);
        m.fitBounds(circle.current.getBounds(), { padding: [24, 24] });
        m.on("click", (e) => {
          setLat(e.latlng.lat.toFixed(5));
          setLng(e.latlng.lng.toFixed(5));
        });
        map.current = m;
      })
      .catch((error: unknown) => console.error("Kartet kunne ikke lastes", error));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      circle.current = null;
    };
    // The map is created once; later changes go through the effect below.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const [la, ln, r] = [parse(lat), parse(lng), parse(radius)];
    if (!circle.current || !valid(la, ln, r)) return;
    circle.current.setLatLng([la, ln]).setRadius(r);
  }, [lat, lng, radius]);

  return (
    <>
      <Field label="Breddegrad">
        <input
          name="lat"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Lengdegrad">
        <input
          name="lng"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Radius (m)">
        <input
          name="radius"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div
        ref={container}
        className="isolate h-80 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 sm:col-span-3"
        aria-label="Kart over området der innsjekk godtas"
      />
    </>
  );
}
