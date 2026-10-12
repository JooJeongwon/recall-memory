"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export function NavLink({ href, children, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(String(href)));
  return <Link href={href} data-active={active || undefined} {...props}>{children}</Link>;
}
