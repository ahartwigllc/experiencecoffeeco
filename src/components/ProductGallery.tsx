"use client";

import { useState } from "react";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="gallery-main" role="img" aria-label={`${title} (no photo yet)`} />;
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gallery-main" src={images[i]} alt={title} />
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((src, idx) => (
            <button key={src} type="button" aria-pressed={idx === i} aria-label={`Show photo ${idx + 1}`} onClick={() => setI(idx)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
