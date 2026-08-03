import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 text-center px-6">
      <h1 className="text-2xl font-semibold">Instrument not found</h1>
      <p className="text-text-muted text-sm">
        That trading symbol doesn&apos;t exist. Try AUDCAD.
      </p>
      <Link href="/trade/AUDCAD" className="mt-2 px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:brightness-110">
        Open AUDCAD
      </Link>
    </div>
  );
}
