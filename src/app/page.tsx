import Image from "next/image";
import Link from "next/link";
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
  const messengerHandle = messenger.web.replace(/^https?:\/\/(www\.)?/i, "");

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
            Upload works best on the shop Wi-Fi
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

          <Divider label="Need Internet Instead?" />

          <div className="mt-5 rounded-2xl border border-[rgba(23,23,23,0.06)] bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Use Browse Internet for apps</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Gmail and Messenger can close the Wi-Fi sign-in screen. If you want to use those apps instead, go back
              and choose Browse Internet on the hotspot page.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-surface-border bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
            <p className="text-sm font-semibold text-foreground">Shop contact details</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              You can also ask staff to open these for you if you prefer sending through your own apps.
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[rgba(23,23,23,0.08)] bg-[rgba(255,248,230,0.45)] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Messenger</p>
                <p className="mt-1 break-all text-sm font-semibold text-foreground">{messengerHandle}</p>
              </div>

              <div className="rounded-xl border border-[rgba(23,23,23,0.08)] bg-[rgba(255,248,230,0.45)] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">Email</p>
                <p className="mt-1 break-all text-sm font-semibold text-foreground">{gmail.to}</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-text-secondary">
              For the fastest in-shop sending, use Upload Files &gt; Shop above.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
