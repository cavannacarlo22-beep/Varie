"use client";

import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

export function WhatsAppButton() {
  if (usePathname().startsWith("/admin")) return null;
  return (
    <a
      href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent("Ciao, vorrei informazioni su un'auto.")}`}
      target="_blank"
      rel="noopener"
      aria-label="Scrivici su WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid place-items-center size-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 hover:scale-105 transition-transform"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.31l-.35-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44zm8.04-17.48A11.3 11.3 0 0 0 12.05.67C5.78.67.68 5.77.68 12.04c0 2 .52 3.96 1.52 5.68L.58 23.5l5.92-1.55a11.33 11.33 0 0 0 5.54 1.41h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.04z" />
      </svg>
    </a>
  );
}
