import { requireVerifiedAccount } from "@/lib/account/auth";
import { DocumentsWorkspace } from "@/components/newton/documents-workspace";
import { listDocuments } from "@/lib/newton/documents";
import { listTeamsForAccount } from "@/lib/newton/teams";

export const dynamic = "force-dynamic";

export default async function NewtonDocumentsPage() {
  const session = await requireVerifiedAccount("/newton/app/docs");
  const [documents, teams] = await Promise.all([
    listDocuments(session.account.id),
    listTeamsForAccount(session.account.id, session.account.email),
  ]);

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-sky">
          Newton · Knowledge
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900 dark:text-white">
          Documents
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-white/45">
          Plans, policies, meeting notes and drafts. Keep a document private or
          share it with one team so everyone works from the same version.
        </p>
      </div>
      <DocumentsWorkspace
        initialDocuments={documents}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      />
    </div>
  );
}
