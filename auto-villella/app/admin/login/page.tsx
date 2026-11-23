"use client";

import { useActionState } from "react";
import Image from "next/image";
import { login } from "../actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="min-h-dvh bg-ink grid place-items-center px-4">
      <form action={action} className="w-full max-w-sm">
        <Image src="/logo.png" alt="Auto Villella" width={600} height={212} className="h-16 w-auto mx-auto" priority />
        <p className="eyebrow text-mist text-center mt-6">Area riservata</p>
        <label className="block mt-8">
          <span className="label text-mist">Password</span>
          <input type="password" name="password" autoComplete="current-password" required autoFocus className="field-dark" />
        </label>
        {error && <p className="text-red text-sm mt-3" role="alert">{error}</p>}
        <button disabled={pending} className="btn-red w-full mt-6">{pending ? "Accesso…" : "Entra"}</button>
      </form>
    </main>
  );
}
