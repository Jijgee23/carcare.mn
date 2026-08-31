import { notFound } from "next/navigation";
import Link from "next/link";
import { FeedbackThread } from "@/app/_components/feedback-thread";
import { Chip, type ChipTone } from "@/app/_components/landing-ops-ui";
import { requireUser } from "@/lib/auth";
import { FEEDBACK_STATUS_LABEL, FEEDBACK_TYPE_LABEL } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { DashboardFeedbackReplyForm } from "./reply-form";

export const metadata = { title: "Санал хүсэлт" };

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, ChipTone> = {
  NEW: "accent",
  IN_REVIEW: "warn",
  RESOLVED: "ok",
  DISMISSED: "neutral",
};

function fmt(d: Date): string {
  return d.toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function DashboardFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const feedback = await prisma.feedback.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!feedback) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
      <Link href="/dashboard/feedback" className="text-sm text-[var(--oc-muted3)] hover:text-[var(--oc-ink2)] transition-colors">
        ← Санал хүсэлт рүү буцах
      </Link>

      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-6 mt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-[var(--oc-ink)]">
            {FEEDBACK_TYPE_LABEL[feedback.type]}
          </h1>
          <Chip tone={STATUS_TONE[feedback.status] ?? "neutral"}>
            {FEEDBACK_STATUS_LABEL[feedback.status]}
          </Chip>
        </div>

        <div className="mt-4 text-sm text-[var(--oc-muted3)]">
          <div>
            Илгээсэн:{" "}
            <span className="text-[var(--oc-ink2)]">
              {feedback.user ? `${feedback.user.lastName} ${feedback.user.firstName}` : "—"}
            </span>
            <span className="text-[var(--oc-muted3)]"> · {fmt(feedback.createdAt)}</span>
          </div>
        </div>

        <p className="mt-5 whitespace-pre-wrap rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel2)] p-4 text-sm text-[var(--oc-ink2)]">
          {feedback.message}
        </p>

        {feedback.screenshotUrl ? (
          <a
            href={feedback.screenshotUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={feedback.screenshotUrl}
              alt="Дэлгэцийн зураг"
              className="max-h-64 rounded-[10px] border border-[var(--oc-line)] object-contain"
            />
          </a>
        ) : null}

        <FeedbackThread messages={feedback.messages} />

        <DashboardFeedbackReplyForm id={feedback.id} />
      </div>
    </div>
  );
}
