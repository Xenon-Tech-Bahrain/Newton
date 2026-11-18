import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/components/account/logout-button";
import { NewtonLogo } from "@/components/brand/logo";
import { NewtonWorkspaceNav } from "@/components/newton/workspace-nav";
import { requireVerifiedAccount } from "@/lib/account/auth";
import { newtonHomePath } from "@/lib/newton/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newton workspace",
  description:
    "Teams, team chat and Aria AI inside Newton for Xenon EcoAccount customers.",
  robots: { index: false, follow: false },
};

export default async function NewtonAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // EcoAccount is the single identity for Newton. Verified email is required so
  // a throwaway address cannot open an account just to reach Aria.
  const session = await requireVerifiedAccount("/newton/app");

  return (
    <div className="flex min-h-screen flex-col bg-mist dark:bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/90">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={newtonHomePath()}
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky"
          >
            <NewtonLogo size={30} showTagline={false} />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-ink-400 dark:text-white/35 sm:inline">
              Team workspace
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={newtonHomePath()}
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white sm:inline-flex"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              Product page
            </Link>
            <Link
              href="/account"
              className="hidden max-w-[16rem] truncate rounded-full px-3 py-2 text-xs font-semibold text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white sm:inline-flex"
            >
              {session.account.email}
            </Link>
            <LogoutButton />
          </div>
        </div>
        <NewtonWorkspaceNav />
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-ink-100 px-4 py-4 text-center text-[0.68rem] leading-5 text-ink-400 dark:border-white/10 dark:text-white/30">
        Aria can be wrong. Check important details before you rely on them. Your
        team chats and Aria conversations are private to your EcoAccount.
      </footer>
    </div>
  );
}
