import Image from "next/image";
import Link from "next/link";

type SearchParams = Promise<{
  name?: string;
  count?: string;
}>;

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const customerName = typeof params.name === "string" ? params.name : "Customer";
  const count = typeof params.count === "string" ? Number.parseInt(params.count, 10) : 0;
  const fileLabel = count === 1 ? "file" : "files";

  return (
    <main className="app-shell flex items-center justify-center">
      <section className="page-wrap customer-wrap">
        <article className="mx-auto w-full max-w-[420px] rounded-[1.75rem] border border-surface-border bg-surface-card px-6 py-7 text-center shadow-[0_10px_28px_rgba(20,23,31,0.10)] sm:px-8 sm:py-8">
          <div className="flex justify-center">
            <div className="w-full max-w-[180px]">
              <Image src="/logo.svg" alt="CJ NET" width={320} height={108} className="h-auto w-full" priority />
            </div>
          </div>
          <h1 className="display-title mt-6 text-3xl font-semibold tracking-tight text-foreground">Done</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            {customerName} sent {count > 0 ? `${count} ${fileLabel}` : "their files"} successfully.
          </p>

          <div className="subtle-panel mt-6 rounded-2xl px-4 py-4 text-left">
            <p className="m-0 font-semibold">What happens next?</p>
            <p className="mt-2 mb-0 text-sm leading-6 text-text-secondary">
              Tell the staff your name so they can open the files from the shared folder.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <Link href="/upload" className="primary-btn w-full text-base font-extrabold">
              Upload another file
            </Link>
            <Link href="/" className="secondary-btn w-full text-base font-bold">
              Back to home
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
