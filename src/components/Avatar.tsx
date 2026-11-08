"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

export function UserAvatar({ name, image }: { name: string; image: string | null }) {
  return (
    <AvatarPrimitive.Root className="relative flex size-8 shrink-0 select-none rounded-full after:absolute after:inset-0 after:rounded-full after:border after:border-white/15">
      {image ? (
        <AvatarPrimitive.Image
          src={avatarImageUrl(image)}
          alt={name}
          className="aspect-square size-full rounded-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center rounded-full bg-blood/20 text-xs font-medium text-zinc-200">
        {initials(name) || "?"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function avatarImageUrl(url: string) {
  if (!url.includes("/api/assets/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}w=160`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}
