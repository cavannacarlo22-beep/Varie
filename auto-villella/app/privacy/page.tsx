import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", robots: { index: false } };

// ⚠️ Testo base: farlo verificare a chi segue la parte legale dell'attività.
export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Informativa" title="Privacy" />
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-6 leading-relaxed [&_h2]:display [&_h2]:text-2xl [&_h2]:pt-4">
        <p>Titolare del trattamento è {site.name}, {site.address}, {site.city} ({site.vat}), contattabile all&apos;indirizzo {site.email}.</p>
        <h2>Quali dati raccogliamo</h2>
        <p>Nome, telefono, email e il contenuto del messaggio che ci invii tramite i moduli del sito, ed eventualmente i dati dell&apos;auto che vuoi farci valutare.</p>
        <h2>Perché</h2>
        <p>Solo per risponderti e gestire la tua richiesta (informazioni, prova, finanziamento, permuta). La base giuridica è la tua richiesta e il tuo consenso.</p>
        <h2>Per quanto tempo</h2>
        <p>Conserviamo i dati per il tempo necessario a gestire la richiesta e comunque non oltre 24 mesi, salvo obblighi di legge se diventi nostro cliente.</p>
        <h2>Con chi li condividiamo</h2>
        <p>Con nessuno, salvo i fornitori tecnici che ospitano il sito e il database e, solo se lo chiedi, con la finanziaria per la pratica di finanziamento.</p>
        <h2>I tuoi diritti</h2>
        <p>Puoi chiedere in ogni momento accesso, rettifica o cancellazione dei tuoi dati scrivendo a {site.email}, e proporre reclamo al Garante per la protezione dei dati personali.</p>
        <h2>Cookie</h2>
        <p>Il sito usa solo cookie tecnici necessari al funzionamento. Non usiamo cookie di profilazione né strumenti di tracciamento pubblicitario.</p>
      </article>
    </>
  );
}
