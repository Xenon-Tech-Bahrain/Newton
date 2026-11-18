"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { NewtonLogo, XenonLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { newtonAppPath, xenonPath, xenonSiteUrl } from "@/lib/newton/site";
import { siteConfig, whatsappMessages, whatsappUrl } from "@/lib/site-config";

/**
 * Chrome for the standalone Newton deployment. The Aria workspace and the
 * EcoAccount screens have their own headers, so they opt out here the same
 * way they do on the Xenon site.
 */
function useIsAppArea() {
  const pathname = usePathname();
  return Boolean(
    pathname?.startsWith("/account") ||
      pathname?.startsWith("/admin") ||
      pathname?.startsWith("/newton/app"),
  );
}

function NewtonHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/90">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky"
        >
          <NewtonLogo size={34} />
          <span className="sr-only">Newton home</span>
        </Link>

        <nav
          aria-label="Newton"
          className="ml-auto hidden items-center gap-1 text-sm font-medium text-ink-600 dark:text-white/65 md:flex"
        >
          <Link
            href="/"
            className="rounded-full px-3 py-2 transition hover:bg-mist hover:text-ink-900 dark:hover:bg-white/5 dark:hover:text-white"
          >
            Overview
          </Link>
          <Link
            href="/account"
            className="rounded-full px-3 py-2 transition hover:bg-mist hover:text-ink-900 dark:hover:bg-white/5 dark:hover:text-white"
          >
            EcoAccount
          </Link>
          <a
            href={xenonSiteUrl()}
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 transition hover:bg-mist hover:text-ink-900 dark:hover:bg-white/5 dark:hover:text-white"
          >
            Xenon Tech
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <Link
            href={newtonAppPath()}
            className="btn-primary btn-sm whitespace-nowrap"
          >
            Open Newton
          </Link>
        </div>
      </div>
    </header>
  );
}

function NewtonFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white dark:border-white/10 dark:bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <NewtonLogo size={40} />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-500 dark:text-white/55">
            {siteConfig.newton.description}
          </p>
          <a
            href={whatsappUrl(whatsappMessages.general)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-sky dark:hover:text-white"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            Ask Xenon about Newton
            <span className="sr-only">(opens WhatsApp in a new tab)</span>
          </a>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-white/45">
            Newton
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link
                href="/"
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                Overview
              </Link>
            </li>
            <li>
              <Link
                href={newtonAppPath()}
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                Aria workspace
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                EcoAccount
              </Link>
            </li>
            <li>
              <a
                href={siteConfig.newton.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                PolyForm NC licence
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-white/45">
            Xenon Tech
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a
                href={xenonSiteUrl()}
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                Company site
              </a>
            </li>
            <li>
              <a
                href={xenonPath("/eula")}
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                End User License Agreement
              </a>
            </li>
            <li>
              <a
                href={xenonPath("/privacy")}
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                Privacy
              </a>
            </li>
            <li>
              <a
                href={xenonPath("/cookies")}
                className="text-ink-600 transition hover:text-ink-900 dark:text-white/60 dark:hover:text-white"
              >
                Cookies
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-100 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-ink-500 dark:text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <XenonLogo size={22} showTagline={false} />
            <span>A Xenon Tech product · {siteConfig.contact.address}</span>
          </div>
          <p>No analytics or advertising trackers.</p>
        </div>
      </div>
    </footer>
  );
}

export function NewtonHeaderGate() {
  return useIsAppArea() ? null : <NewtonHeader />;
}

export function NewtonFooterGate() {
  return useIsAppArea() ? null : <NewtonFooter />;
}
