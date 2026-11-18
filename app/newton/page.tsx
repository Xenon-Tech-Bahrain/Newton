import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CircleCheck,
  GitBranch,
  GraduationCap,
  MessageCircle,
  PenLine,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { OAuthButton } from "@/components/account/oauth-button";
import { EcoAccountIcon, GoogleIcon } from "@/components/brand/oauth-icons";
import { AiAssistantPanel } from "@/components/ai-assistant-panel";
import { AtomicRings } from "@/components/brand/atomic-rings";
import { NewtonLogo, NewtonMark } from "@/components/brand/logo";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { createMetadata } from "@/lib/metadata";
import {
  isNewtonDeployment,
  newtonAppPath,
  newtonSiteUrl,
  xenonPath,
  xenonSiteUrl,
} from "@/lib/newton/site";
import {
  siteConfig,
  whatsappMessages,
  whatsappUrl,
} from "@/lib/site-config";

const newtonTitle = "Newton — The B2B workspace for teams";
const newtonDescription =
  "Newton is Xenon Tech's source-available B2B workspace — Notion-style documents, Teams-style chat, and Aria AI built in. One place for your team to write, plan, decide and ship work together.";

export const metadata: Metadata = isNewtonDeployment()
  ? {
      title: { absolute: newtonTitle },
      description: newtonDescription,
      alternates: { canonical: "/" },
      openGraph: {
        type: "website",
        locale: siteConfig.locale,
        url: newtonSiteUrl(),
        siteName: siteConfig.newton.name,
        title: newtonTitle,
        description: newtonDescription,
        images: [
          {
            url: "/newton-og.png",
            width: 1200,
            height: 630,
            alt: "Newton — Source-available AI for business",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: newtonTitle,
        description: newtonDescription,
        images: ["/newton-og.png"],
      },
    }
  : createMetadata({
      title: newtonTitle,
      description: newtonDescription,
      path: "/newton",
      absoluteTitle: true,
    });

const newtonSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.newton.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${newtonSiteUrl()}${siteConfig.newton.appPath}`,
  description: siteConfig.newton.description,
  license: siteConfig.newton.licenseUrl,
  publisher: {
    "@type": "Organization",
    name: siteConfig.name,
    url: xenonSiteUrl(),
  },
  areaServed: {
    "@type": "Country",
    name: "Bahrain",
  },
  featureList: [
    "Team documents & notes",
    "Team chat & channels",
    "Aria AI built in",
    "Source-available under PolyForm Noncommercial",
    "One B2B workspace",
  ],
};

const audiences = [
  {
    icon: Building2,
    title: "Founders & small teams",
    description:
      "One workspace for documents, decisions and chat — no more switching between five tools.",
  },
  {
    icon: Briefcase,
    title: "Sales & marketing",
    description:
      "Shared docs for briefs, chat for campaigns, Aria AI to draft first versions faster.",
  },
  {
    icon: Workflow,
    title: "Operations",
    description:
      "A knowledge base your team actually uses, with decisions and next steps in one place.",
  },
  {
    icon: GraduationCap,
    title: "Professional services",
    description:
      "Client work, internal notes and team chat — with AI drafting and human judgement in charge.",
  },
];

const ariaPoints = [
  "AI that lives inside your team workspace",
  "Drafts plans, summaries and decisions from your work",
  "Keeps human judgement in charge of the output",
];

const principles = [
  {
    icon: Sparkles,
    title: "One workspace, not five",
    description:
      "Documents, chat, knowledge base and AI in Newton — your team stops switching tools.",
  },
  {
    icon: ShieldCheck,
    title: "Human judgement stays in charge",
    description:
      "AI output is a starting point. Your team reviews, edits and decides what is right.",
  },
  {
    icon: Scale,
    title: "Clear about the limits",
    description:
      "AI can be wrong, incomplete or out of date. We would rather be honest about that than oversell it.",
  },
];

export default function NewtonPage() {
  return (
    <>
      {/* Newton hero */}
      <section className="on-dark relative overflow-hidden bg-hero-gradient text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid opacity-60"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 -top-56 h-[42rem] w-[42rem] rounded-full bg-brand-500/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 left-1/4 h-[30rem] w-[30rem] rounded-full bg-sky/10 blur-3xl"
        />
        <AtomicRings className="absolute -right-32 top-1/2 h-[44rem] w-[44rem] -translate-y-1/2 text-white/75" />

        <div className="container-page relative grid gap-14 py-20 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-32">
          <div>
            <NewtonLogo variant="light" size={50} />
            <p className="eyebrow mt-8">Newton · Source-available B2B workspace</p>
            <h1 className="mt-4 font-display text-[2.7rem] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-[4.2rem]">
              Your team&apos;s workspace.
              <br />
              Documents, chat and AI — in one place.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Newton is Xenon Tech&apos;s full B2B workspace for teams. Think
              Notion-style documents and knowledge base, Teams-style chat and
              collaboration, with Aria AI built in to help write plans, drafts,
              summaries and decisions — all in one place your whole team can
              use.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={newtonAppPath()} className="btn-light btn-lg">
                Open Newton
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link href={xenonPath("/contact")} className="btn-glass btn-lg">
                Ask Xenon about Newton
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              <p className="relative text-center text-sm text-white/70">
                <span className="relative bg-hero-gradient px-2">
                  Or continue with
                </span>
                <span className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/20" />
                </span>
              </p>
              <OAuthButton
                label="Continue with Google"
                icon={<GoogleIcon className="h-4 w-4" />}
                href="/api/account/oauth/google/start"
              />
              <OAuthButton
                label="Continue with Xenon EcoAccount"
                icon={<EcoAccountIcon className="h-4 w-4" />}
                href="/account/oauth/start"
              />
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/80 sm:text-sm">
              {[
                "Documents & notes",
                "Team chat & collaboration",
                "Aria AI built in",
                "Source-available · PolyForm Noncommercial",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-sky" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs text-white/65">
              Newton runs inside your Xenon EcoAccount. Sign in, or create a free
              account in a minute, and your team workspace is ready.
            </p>
          </div>

          {/* Brand visual */}
          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div
              aria-hidden="true"
              className="absolute inset-10 rounded-full bg-brand-500/30 blur-3xl"
            />
            <div className="glass relative p-8 sm:p-10">
              <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
                <AtomicRings className="absolute inset-0 h-full w-full animate-[orbit_80s_linear_infinite] text-white/80" />
                <NewtonMark size={92} />
              </div>
              <p className="mt-8 text-center font-display text-2xl font-semibold tracking-tight text-white">
                One workspace for your team.
              </p>
              <p className="mt-2 text-center text-sm leading-6 text-white/70">
                Write documents, chat with your team, and let Aria AI help —
                all inside Newton.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-2">
                {["Think", "Write", "Act"].map((label) => (
                  <span
                    key={label}
                    className="rounded-xl border border-white/10 bg-white/[0.06] py-2 text-center text-xs font-medium text-white/70"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="glass-soft absolute -bottom-5 -left-4 hidden items-center gap-2.5 p-3 pr-4 sm:flex">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sky">
                <Building2 className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-white">
                  For business
                </span>
                <span className="block text-[0.62rem] text-white/70">
                  Not another toy
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="section-pad bg-white dark:bg-ink-950">
        <div className="container-page grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <Reveal>
            <SectionHeading
              eyebrow="What Newton is"
              title="Notion documents, Teams chat, Aria AI — merged."
              description="Newton is Xenon Tech&apos;s source-available B2B workspace. Your team writes documents, keeps a knowledge base, chats in channels, and gets AI help — all in one place instead of switching between five tools."
            />
            <div className="mt-6 space-y-4 text-base leading-8 text-ink-600">
              <p>
                Most teams juggle a document tool, a chat app, a knowledge base
                and an AI assistant — none of them talking to each other. Newton
                brings them together in one workspace your whole team actually
                uses.
              </p>
              <p>
                It is a separate product from our device services, and it lives
                inside Xenon EcoAccount: one sign-in covers the customer portal
                and your team workspace at{" "}
                <Link
                  href={newtonAppPath()}
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4"
                >
                  /newton/app
                </Link>
                . Create shared documents, chat with teammates, assign work, and
                let Aria AI draft plans, summaries and decisions — with human
                judgement still in charge.
              </p>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-400/25 dark:bg-emerald-400/10">
              <GitBranch
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
              />
              <p className="text-xs leading-5 text-ink-600">
                <strong className="font-semibold text-ink-900">
                  Source-available.
                </strong>{" "}
                Newton&apos;s source code is published under the{" "}
                <a
                  href={siteConfig.newton.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4"
                >
                  PolyForm Noncommercial License 1.0.0
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                : read, run, change and share it for any noncommercial purpose.
                The licence does not grant commercial use; that needs a paid plan
                or a commercial licence.{" "}
                <a
                  href={siteConfig.newton.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4"
                >
                  Read the source on GitHub
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                . The hosted service is covered by our{" "}
                <Link
                  href={xenonPath("/eula")}
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4"
                >
                  EULA
                </Link>
                .
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={newtonAppPath()} className="btn-primary btn-md">
                Open Newton
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link href={xenonPath("/contact")} className="btn-outline btn-md">
                Talk to Xenon
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal className="space-y-4">
            <div className="relative overflow-hidden rounded-[2rem] bg-ink-gradient p-7 text-white shadow-card sm:p-8">
              <AtomicRings className="absolute -right-24 -top-28 h-72 w-72 text-white/80" />
              <div className="relative flex items-center gap-3">
                <NewtonMark size={46} />
                <div>
                  <p className="font-display text-lg font-semibold text-white">
                    Not just another AI chatbot.
                  </p>
                  <p className="text-xs text-white/70">
                    A full B2B workspace your team uses every day.
                  </p>
                </div>
              </div>
              <ul className="relative mt-6 space-y-3">
                {[
                  "Documents your whole team can edit",
                  "Team chat and channels",
                  "Knowledge base that actually gets used",
                  "Aria AI to draft plans, summaries and decisions",
                  "Output you can review, edit and use",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-white/70"
                  >
                    <CircleCheck
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-sky"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: PenLine, label: "Write", text: "Shared documents & notes" },
                { icon: MessageCircle, label: "Chat", text: "Team channels & messages" },
                { icon: Workflow, label: "Act", text: "Move work forward together" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-ink-100 bg-mist p-4"
                  >
                    <Icon aria-hidden="true" className="h-5 w-5 text-brand-600" />
                    <p className="mt-3 text-sm font-semibold text-ink-900">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Aria AI */}
      <section className="relative overflow-hidden bg-brand-50/50 section-pad dark:bg-brand-500/[0.06]">
        <div className="container-page grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <Reveal>
            <AiAssistantPanel
              name="Aria"
              role="AI inside Newton"
              prompt="Turn this team brief into a clear plan."
              response="Aria is built into Newton to help your team draft plans, summaries and decisions — with human review at every step."
              chips={[
                "Built into Newton",
                "Business-focused",
                "Human judgement",
              ]}
            />
          </Reveal>

          <Reveal>
            <p className="eyebrow">Aria AI · Inside your workspace</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.035em] text-ink-900 sm:text-4xl">
              Aria helps your team get work done
              <br className="hidden sm:block" /> inside Newton.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink-600">
              Aria is the AI inside Newton — not a separate tool. It drafts
              plans, summaries and decisions from your team&apos;s actual work,
              while your team reviews, edits and decides what is right.
            </p>
            <ul className="mt-7 space-y-4">
              {ariaPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-sm text-ink-600"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-brand-100">
                    <Check aria-hidden="true" className="h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={whatsappUrl(whatsappMessages.newton)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-md"
              >
                <MessageCircle aria-hidden="true" className="h-4 w-4" />
                Ask about Newton
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <Link href={xenonPath("/contact")} className="btn-outline btn-md">
                Contact Xenon
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Who it's for */}
      <section className="relative overflow-hidden bg-mist section-pad">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid-light opacity-60"
        />
        <div className="container-page relative">
          <SectionHeading
            eyebrow="Who it's for"
            title="Built for teams with work to do."
            description="Newton is for businesses that want one place to work — documents, chat and AI — instead of switching between five tools. If your team writes, researches, plans or communicates, there is something here to explore."
            align="center"
          />

          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map((audience) => {
              const Icon = audience.icon;
              return (
                <div
                  key={audience.title}
                  className="rounded-2xl border border-ink-100 bg-white p-5 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-soft"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-ink-900">
                    {audience.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    {audience.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <div
                  key={principle.title}
                  className="flex gap-3 rounded-2xl border border-ink-100 bg-white p-5"
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"
                  />
                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink-900">
                      {principle.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-ink-500">
                      {principle.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to start */}
      <section className="section-pad bg-white dark:bg-ink-950">
        <div className="container-page grid items-start gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="reveal">
            <SectionHeading
              eyebrow="Getting started"
              title="Set up your team workspace."
              description="The best way to understand Newton is to bring your team&apos;s actual work — documents, chat, decisions — not a test prompt."
            />
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={newtonAppPath()} className="btn-dark btn-lg">
                Open Newton
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <a
                href={whatsappUrl(
                  "Hi Xenon, I'd like to know more about Newton for my business.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline btn-lg"
              >
                <MessageCircle aria-hidden="true" className="h-4 w-4" />
                Ask a question
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>

          <ol className="reveal space-y-4">
            {[
              {
                title: "Sign in and open Newton",
                text: "Use your Xenon EcoAccount. No download, no separate login, no new password to remember.",
              },
              {
                title: "Create your first document",
                text: "Start a shared doc, add teammates, and write together in real time.",
              },
              {
                title: "Chat with your team",
                text: "Use channels and messages to discuss work where it happens.",
              },
              {
                title: "Let Aria help",
                text: "Ask Aria to draft plans, summaries and decisions — then review and refine.",
              },
            ].map((step, index) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-2xl border border-ink-100 bg-mist p-5"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 font-mono text-xs font-semibold text-white">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-500">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="pb-20 sm:pb-24 lg:pb-28">
        <div className="container-page">
          <div className="on-dark relative overflow-hidden rounded-[2rem] bg-ink-gradient p-7 text-white shadow-card sm:p-10 lg:p-12">
            <AtomicRings className="absolute -right-24 -top-28 h-80 w-80 text-white/80" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <NewtonLogo variant="light" size={42} />
                <h2 className="mt-6 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                  See what a real team workspace looks like.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                  Newton opens inside your EcoAccount, with your team&apos;s
                  documents, chat and AI in one place. Private to your account,
                  built for your whole team. For a walkthrough or a business
                  question, message Xenon directly.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
                <Link href={newtonAppPath()} className="btn-light btn-lg">
                  Open Newton
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <a
                  href={whatsappUrl(whatsappMessages.general)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-glass btn-lg"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  WhatsApp Xenon
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>

              <div className="mt-6 space-y-3">
                <p className="relative text-center text-sm text-white/60">
                  <span className="relative bg-ink-gradient px-2">
                    Or continue with
                  </span>
                  <span className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/20" />
                  </span>
                </p>
                <OAuthButton
                  label="Continue with Google"
                  icon={<GoogleIcon className="h-4 w-4" />}
                  href="/api/account/oauth/google/start"
                />
                <OAuthButton
                  label="Continue with Xenon EcoAccount"
                  icon={<EcoAccountIcon className="h-4 w-4" />}
                  href="/account/oauth/start"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <JsonLd data={newtonSchema} />
    </>
  );
}
