import Image from "next/image";
import Link from "next/link";
import EmailActionLink from "@/app/_components/email-action-link";
import MessengerActionLink from "@/app/_components/messenger-action-link";
import {
  buildGmailAndroidIntentComposeUrl,
  buildGmailIOSAppComposeUrl,
  buildGmailWebComposeUrl,
  buildMailtoUrl,
} from "@/lib/email-links";
import { getGmailConfig, getMessengerLinks } from "@/lib/config";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 16V5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlatformIcon({ src, alt }: { src: string; alt: string }) {
  return <Image src={src} alt={alt} width={20} height={20} className="h-5 w-5" priority />;
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-surface-border" />
      <div className="text-[11px] font-semibold tracking-wide text-text-secondary">{label}</div>
      <div className="h-px flex-1 bg-surface-border" />
    </div>
  );
}

export default function HomePage() {
  const messenger = getMessengerLinks();
  const gmail = getGmailConfig();

  const body = [
    "Hi CJ NET,",
    "",
    "Please print my file.",
    "",
    "Name:",
    "Notes:",
    "",
    "Reminder: Please attach your file before sending.",
  ].join("\n");

  return (
    <main className="app-shell flex items-center justify-center">
      <section className="page-wrap customer-wrap">
        <article className="mx-auto w-full max-w-[420px] rounded-[1.75rem] border border-surface-border bg-surface-card px-6 py-7 shadow-[0_10px_28px_rgba(20,23,31,0.10)] sm:px-8 sm:py-8">
          <div className="flex justify-center">
            <Link href="/" className="utility-logo-link w-full max-w-[180px]">
              <Image src="/logo.svg" alt="CJ NET shop logo" width={360} height={120} className="h-auto w-full" priority />
            </Link>
          </div>

          <p className="mt-6 text-center text-sm font-medium text-text-secondary">
            Choose a platform to send your file
          </p>

          <div className="mt-5">
            <Link
              href="/upload"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-yellow px-4 py-4 text-sm font-bold tracking-[-0.01em] text-foreground shadow-[0_1px_0_rgba(0,0,0,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(244,212,0,0.30)]"
            >
              <UploadIcon />
              <span>Upload Files &gt; Shop</span>
            </Link>
          </div>

          <Divider label="Alternative Platforms" />

          <div className="mt-5 space-y-3">
            <EmailActionLink
              hrefWebDesktop={buildGmailWebComposeUrl({ to: gmail.to, subject: gmail.subject, body })}
              hrefMailtoFallback={buildMailtoUrl({ to: gmail.to, subject: gmail.subject, body })}
              hrefGmailAppIOS={buildGmailIOSAppComposeUrl({ to: gmail.to, subject: gmail.subject, body })}
              hrefGmailAppAndroid={buildGmailAndroidIntentComposeUrl({ to: gmail.to, subject: gmail.subject, body })}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-surface-border bg-white px-4 py-4 text-sm font-bold tracking-[-0.01em] text-foreground shadow-[0_1px_0_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(244,212,0,0.18)]"
            >
              <PlatformIcon src="/icons/gmail.svg" alt="Gmail" />
              <span>Gmail</span>
              <span className="sr-only">(opens compose)</span>
            </EmailActionLink>

            <MessengerActionLink
              hrefWeb={messenger.web}
              hrefApp={messenger.app}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-platform-messenger px-4 py-4 text-sm font-bold tracking-[-0.01em] text-white shadow-[0_1px_0_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(24,119,242,0.25)]"
            >
              <span className="text-white" aria-hidden="true">
                <PlatformIcon src="/icons/messenger.svg" alt="" />
              </span>
              <span>Messenger</span>
            </MessengerActionLink>
          </div>

          <div className="mt-5 rounded-2xl border border-[rgba(23,23,23,0.06)] bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Best inside the shop</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Upload works best on the shop Wi-Fi. Messenger and Gmail may need internet. If they do not open, use
              Upload instead or switch to Browse Internet.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
