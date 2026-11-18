import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  MessageCircle,
  PenLine,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import { OAuthButton } from "@/components/account/oauth-button";
import { EcoAccountIcon, GoogleIcon } from "@/components/brand/oauth-icons";
import { NewtonLogo } from "@/components/brand/logo";
import { PageHero, SectionHeading } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { createMetadata } from "@/lib/metadata";
import {
  isNewtonDeployment,
  newtonAppPath,
  newtonHomePath,
  newtonSiteUrl,
  xenonPath,
} from "@/lib/newton/site";
import { listNewtonPlans } from "@/lib/newton/plans";
import { siteConfig, whatsappMessages, whatsappUrl } from "@/lib/site-config";

const newtonTitle = "Newton Pricing — B2B workspace for teams";
const newtonDescription =
  "Simple, transparent pricing for Newton — the source-available B2B workspace with documents, team chat and Aria AI. Free for non-commercial use, Pro and Max plans for teams, Enterprise by negotiation.";

export const metadata: Metadata = isNewtonDeployment()
  ? {
      title: { absolute: newtonTitle },
      description: newtonDescription,
      alternates: { canonical: "/" },
    }
  : {
      title: newtonTitle,
      description: newtonDescription,
      alternates: { canonical: newtonSiteUrl() },
    };

function bhdFromUsd(usd: number) {
  return (usd * 0.376).toFixed(3);
}

export const dynamic = "force-dynamic";

export default async function NewtonPricingPage() {
  const plans = await listNewtonPlans({ activeOnly: true });

  return (
    <>
      <PageHero
        eyebrow="Newton pricing"
        title="One price for your team workspace."
        description="Newton is free for non-commercial use. Pro and Max plans give teams commercial access to documents, chat and Aria AI — with higher limits and priority support. Enterprise is priced per agreement."
      >
        <a
          href={whatsappUrl(whatsappMessages.newton)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-light btn-md"
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          Ask about Newton
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <Link href={newtonAppPath()} className="btn-glass btn-md">
          Open Newton
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </PageHero>

      <section className="section-pad bg-white dark:bg-ink-950">
        <div className="container-page">
          <SectionHeading
            eyebrow="Newton plans"
            title="Choose the plan that fits your team."
            description="Every plan includes documents, team chat and Aria AI. The difference is usage limits, commercial rights and support."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((details) => {
                const plan = details.key;
                const isFree = plan === "free";
                const isEnterprise = plan === "enterprise";
                const usd = details.usdPerMonth;
                const bhd =
                  details.bhdPerMonth ?? Number(bhdFromUsd(details.usdPerMonth));

                return (
                  <article
                    key={plan}
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 transition duration-300 sm:p-8 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card"
                  >
                    <div className="relative flex items-center gap-3 mb-4">
                      <span
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"
                      >
                        <BrainCircuit
                          aria-hidden="true"
                          className="h-5 w-5"
                        />
                      </span>
                      <h3 className="font-display text-lg font-semibold tracking-tight text-ink-900">
                        {details.label}
                      </h3>
                      {plan === "free" && (
                        <span className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[0.58rem] font-semibold text-ink-600">
                          <Scale aria-hidden="true" className="h-3 w-3" />
                          Free
                        </span>
                      )}
                    </div>

                    <p className="mb-6 text-sm leading-6 text-ink-600">
                      {details.description}
                    </p>

                    <div className="relative mt-auto flex items-end gap-2 mb-2">
                      {isEnterprise ? (
                        <>
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                            Contact us
                          </span>
                          <span className="font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink-900">
                            —
                          </span>
                          <span className="pb-1.5 font-display text-sm font-semibold text-brand-700">
                            /month
                          </span>
                        </>
                      ) : isFree ? (
                        <>
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                            Per month
                          </span>
                          <span className="font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink-900">
                            {usd}
                          </span>
                          <span className="pb-1.5 font-display text-sm font-semibold text-brand-700">
                            USD
                          </span>
                          <span className="ml-1 text-xs font-semibold text-ink-500">
                            (≈ BHD {bhd?.toFixed(3)})
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                            Per month
                          </span>
                          <span className="font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink-900">
                            {usd}
                          </span>
                          <span className="pb-1.5 font-display text-sm font-semibold text-brand-700">
                            USD
                          </span>
                          <span className="ml-1 text-xs font-semibold text-ink-500">
                            (≈ BHD {bhd?.toFixed(3)})
                          </span>
                        </>
                      )}
                    </div>

                    <ul className="mt-auto space-y-3">
                      {details.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2.5">
                          <span
                            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
                          >
                            <Check aria-hidden="true" className="h-3 w-3" />
                          </span>
                          <span className="text-sm text-ink-600">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-6">
                      {isEnterprise ? (
                        <a
                          href={whatsappUrl(whatsappMessages.newton)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full btn-primary btn-md"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Contact Xenon
                          <span className="sr-only">(opens in a new tab)</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      ) : isFree ? (
                        <Link
                          href={newtonHomePath()}
                          className="w-full btn-outline btn-md"
                        >
                          Get started free
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <Link
                          href={newtonHomePath()}
                          className="w-full btn-primary btn-md"
                        >
                          Choose {details.label}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>

          <div className="mt-12 flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 dark:border-brand-500/25 dark:bg-brand-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-ink-700">
              <strong className="font-semibold text-ink-900">
                Important:
              </strong>{" "}
              The Free plan is for personal, non-commercial evaluation only. If
              you use Newton for business, client work or inside a company,
              choose Pro, Max or Enterprise. Commercial use on the Free plan
              breaches the{" "}
              <Link
                href={xenonPath("/eula#newton-plans")}
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800 dark:text-sky dark:hover:text-white"
              >
                End User License Agreement
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-mist section-pad">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid-light opacity-60"
        />
        <div className="container-page relative grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="How Newton works"
              title="From sign-in to team workspace."
              description="Newton lives inside your Xenon EcoAccount. One account, one sign-in for your whole team."
            />
            <ol className="mt-8 space-y-4">
              {[
                {
                  step: "1",
                  title: "Create an EcoAccount",
                  text: "Sign up at xenonbh.vercel.app/ecoaccount and verify your email.",
                },
                {
                  step: "2",
                  title: "Choose a Newton plan",
                  text: "Admin assigns Free, Pro, Max or Enterprise to your account.",
                },
                {
                  step: "3",
                  title: "Open your team workspace",
                  text: "Go to /newton/app — documents, chat and Aria AI await your team.",
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="flex gap-4"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 font-mono text-xs font-semibold text-white">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-ink-500">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <SectionHeading
              eyebrow="What you get"
              title="Your team workspace in one place."
              description="Documents, team chat and Aria AI — everything your team needs to work together."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: PenLine,
                  title: "Documents & notes",
                  text: "Shared docs your whole team can edit and organize.",
                },
                {
                  icon: MessageCircle,
                  title: "Team chat & channels",
                  text: "Conversations where the work actually happens.",
                },
                {
                  icon: Sparkles,
                  title: "Aria AI assistance",
                  text: "Draft plans, summaries and decisions inside your workspace.",
                },
                {
                  icon: Users,
                  title: "Team collaboration",
                  text: "Work together, review output and decide as a team.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-ink-100 bg-white p-5"
                >
                  <item.icon
                    aria-hidden="true"
                    className="h-5 w-5 text-brand-600"
                  />
                  <h3 className="mt-4 font-display text-base font-semibold text-ink-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-ink-500">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is Newton free?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Newton has a Free plan at BHD 0 per month, but it is not for commercial use. Commercial use requires Pro, Max or Enterprise.",
              },
            },
            {
              "@type": "Question",
              name: "What model does Newton use?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Newton uses Xenon-tech-BHR/Aria-newton-AI:3.5-flash-lite (Gemini 3.5 Flash Lite) on every plan.",
              },
            },
            {
              "@type": "Question",
              name: "Can I upgrade later?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Yes. Xenon Tech admin can change your plan at any time from the admin console.",
              },
            },
          ],
        }}
      />
    </>
  );
}
