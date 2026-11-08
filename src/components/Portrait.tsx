"use client";

import { useState } from "react";

export function Portrait({ className = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    // oxlint-disable-next-line jsx-a11y/alt-text
    <img
      {...props}
      ref={(img) => {
        if (img?.complete) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      data-loaded={loaded}
      className={`portrait ${className}`}
    />
  );
}
