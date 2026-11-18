import { siteConfig } from "@/lib/site-config";

/**
 * The Newton site runs from the same repository as xenonbh.vercel.app but as a
 * separate Vercel project. `NEWTON_SITE=true` is set on that project only, so
 * the flag is fixed at build time and does not force dynamic rendering.
 */
export function isNewtonDeployment() {
  return process.env.NEWTON_SITE?.trim() === "true";
}

/** Canonical URL of the standalone Newton site. */
export function newtonSiteUrl() {
  return isNewtonDeployment() ? siteConfig.url : siteConfig.newton.url;
}

/**
 * The Newton overview page lives at `/` on newtonbh.vercel.app and at
 * `/newton` on the Xenon site. Proxy rewrites the Newton host root internally,
 * so every link must use this helper rather than a hardcoded path.
 */
export function newtonHomePath() {
  return isNewtonDeployment() ? "/" : "/newton";
}

/**
 * The Aria workspace keeps the same path on both sites. On the Xenon site it
 * is an entry point into the standalone Newton site rather than a local page.
 */
export function newtonAppPath() {
  return siteConfig.newton.appPath;
}

/** Absolute entry point to the Aria workspace, safe to use from either site. */
export function newtonAppUrl() {
  return isNewtonDeployment()
    ? siteConfig.newton.appPath
    : `${siteConfig.newton.url}${siteConfig.newton.appPath}`;
}

/** Where EcoAccount and the admin console live. */
export function xenonSiteUrl() {
  return siteConfig.xenonUrl;
}

/**
 * Link to a Xenon-only page. Internal on the Xenon site, absolute on the
 * Newton site so visitors always land on the canonical Xenon copy.
 */
export function xenonPath(path: string) {
  return isNewtonDeployment() ? `${siteConfig.xenonUrl}${path}` : path;
}
