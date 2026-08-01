import { ExplainOggiButton } from "@/components/dashboard/explain-oggi-button";

/**
 * Commento AI "Spiega la mia giornata" (Passo 6) sotto il ReadinessRing.
 * Server Component: il bottone (client) è l'unico confine interattivo,
 * stesso schema del blocco commento in components/profile/profile-tabs.tsx.
 */
export function OggiComment({
  enabled,
  comment,
  commentAt,
}: {
  enabled: boolean;
  comment: string | null;
  commentAt: string | null;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-surface px-5 py-4">
      {comment && (
        <>
          <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
            {comment}
          </p>
          {commentAt && (
            <p className="mb-2 mt-1.5 text-[11px] text-faint">
              Commento AI · {new Date(commentAt).toLocaleDateString("it-IT")}
            </p>
          )}
        </>
      )}
      <ExplainOggiButton enabled={enabled} hasComment={comment != null} />
    </div>
  );
}
