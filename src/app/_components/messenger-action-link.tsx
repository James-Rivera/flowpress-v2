"use client";

import type { MouseEvent, ReactNode } from "react";

type Props = {
  hrefWeb: string;
  hrefApp: string;
  className?: string;
  children: ReactNode;
};

function isMobileUserAgent(userAgent: string) {
  return /(android|iphone|ipad|ipod|mobile)/i.test(userAgent);
}

export default function MessengerActionLink({ hrefWeb, hrefApp, className, children }: Props) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const userAgent = navigator.userAgent ?? "";

    if (!isMobileUserAgent(userAgent)) {
      return;
    }

    event.preventDefault();

    let fallbackTimer = 0;

    const cancelOnHidden = () => {
      if (!document.hidden) {
        return;
      }

      window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", cancelOnHidden);
    };

    document.addEventListener("visibilitychange", cancelOnHidden);

    fallbackTimer = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", cancelOnHidden);
      window.location.assign(hrefWeb);
    }, 800);

    window.location.assign(hrefApp);
  }

  return (
    <a href={hrefWeb} onClick={onClick} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
