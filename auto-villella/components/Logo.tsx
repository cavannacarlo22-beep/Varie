import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Auto Villella, home" className="shrink-0">
      <Image src="/logo.png" alt="Auto Villella" width={600} height={212} priority className={className} />
    </Link>
  );
}
