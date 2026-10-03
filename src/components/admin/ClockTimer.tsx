"use client";

import { useEffect, useState } from "react";

/** Live elapsed time since an ISO timestamp, e.g. 2:14:09. */
export function ClockTimer({ since }: { since: string }) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <div className="clock-face" aria-live="off">
      {h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}
