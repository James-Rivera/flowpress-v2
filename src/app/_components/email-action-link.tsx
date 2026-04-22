"use client";

import type { MouseEvent, ReactNode } from "react";

type Props = {
  hrefWebDesktop: string;
  hrefMailtoFallback: string;
  hrefGmailAppIOS: string;
  hrefGmailAppAndroid: string;
  className?: string;
  children: ReactNode;
};

function isIOSUserAgent(userAgent: string) {
  return /(iphone|ipad|ipod)/i.test(userAgent);
}

function isAndroidUserAgent(userAgent: string) {
  return /android/i.test(userAgent);
}

function isMobileUserAgent(userAgent: string) {
  return /(android|iphone|ipad|ipod|mobile)/i.test(userAgent);
}

export default function EmailActionLink({
  hrefWebDesktop,
  hrefMailtoFallback,
  hrefGmailAppIOS,
  hrefGmailAppAndroid,
  className,
  children,
}: Props) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const userAgent = navigator.userAgent ?? "";

    if (!isMobileUserAgent(userAgent)) {
      return;
    }

    const shouldHandleIOS = isIOSUserAgent(userAgent);
    const shouldHandleAndroid = isAndroidUserAgent(userAgent);

    if (!shouldHandleIOS && !shouldHandleAndroid) {
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
      window.location.assign(hrefMailtoFallback);
    }, 800);

    window.location.assign(shouldHandleIOS ? hrefGmailAppIOS : hrefGmailAppAndroid);
  }

  return (
    <a href={hrefWebDesktop} onClick={onClick} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
