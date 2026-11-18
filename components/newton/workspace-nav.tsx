"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/newton/app", label: "Overview", icon: LayoutDashboard },
  { href: "/newton/app/chat", label: "Chat", icon: MessagesSquare },
  { href: "/newton/app/docs", label: "Documents", icon: FileText },
  { href: "/newton/app/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/newton/app/teams", label: "Teams", icon: Users },
  { href: "/newton/app/aria", label: "Aria AI", icon: Sparkles },
];

export function NewtonWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Newton workspace sections"
      className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6"
    >
      {links.map((link) => {
        const active =
          link.href === "/newton/app"
            ? pathname === "/newton/app"
            : pathname.startsWith(link.href);
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:text-sm",
              active
                ? "bg-brand-50 text-brand-800 dark:bg-sky/10 dark:text-sky"
                : "text-ink-500 hover:bg-ink-50 hover:text-ink-900 dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white",
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
