import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7efe6_0%,#ead8c7_100%)] px-6 text-[#2f2219]">
      <section className="w-full max-w-md rounded-[28px] border border-[#caa98b]/50 bg-white/90 p-8 shadow-[0_24px_60px_rgba(80,44,21,0.12)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9b5a32]">
          Offline
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Kira Bakery Admin is offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#6a4b36]">
          Your device has no network connection right now. Reconnect to keep working with
          live orders, products, and inventory.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-full bg-[#9b5a32] px-5 py-3 text-sm font-medium text-white"
          >
            Retry
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#d4b49a] px-5 py-3 text-sm font-medium text-[#6a4b36]"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
