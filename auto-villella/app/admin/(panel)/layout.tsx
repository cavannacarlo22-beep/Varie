import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { logout } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestione", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminConfigured()) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md">
          <p className="display text-3xl">Pannello non ancora attivo</p>
          <p className="mt-4 text-steel">Imposta la variabile <code className="bg-white px-1.5 py-0.5 border border-line">ADMIN_PASSWORD</code> nelle impostazioni del progetto su Vercel, poi rifai il deploy.</p>
        </div>
      </main>
    );
  }
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-6">
          <Link href="/admin"><Image src="/logo.png" alt="Auto Villella" width={600} height={212} className="h-9 w-auto" /></Link>
          <nav className="flex gap-5 text-sm">
            <Link href="/admin" className="text-mist hover:text-white">Auto</Link>
            <Link href="/admin/richieste" className="text-mist hover:text-white">Richieste</Link>
            <Link href="/" target="_blank" className="text-mist hover:text-white">Vedi sito ↗</Link>
          </nav>
          <form action={logout} className="ml-auto"><button className="text-sm text-mist hover:text-white">Esci</button></form>
        </div>
      </header>
      {!hasDb && (
        <div className="bg-amber-100 text-amber-900 text-sm px-4 py-3 text-center">
          Database non collegato: il sito mostra le auto dimostrative e non è possibile salvare modifiche. Imposta <b>DATABASE_URL</b> su Vercel.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
