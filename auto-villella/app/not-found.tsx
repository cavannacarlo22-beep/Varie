import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-ink text-white min-h-[60vh] grid place-items-center px-4">
      <div className="text-center">
        <p className="display text-[8rem] leading-none text-red">404</p>
        <p className="display text-3xl mt-4">Strada sbagliata</p>
        <p className="text-mist mt-3">Questa pagina non esiste, o l&apos;auto è già stata venduta.</p>
        <Link href="/veicoli" className="btn-red mt-8">Vedi le auto disponibili</Link>
      </div>
    </section>
  );
}
