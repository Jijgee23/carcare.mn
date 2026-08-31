import { notFound } from "next/navigation";
import Link from "next/link";
import { FeedbackThread } from "@/app/_components/feedback-thread";
import { requireSuperAdmin } from "@/lib/auth/system";
import { FEEDBACK_TYPE_LABEL } from "@/lib/feedback";
import { formatPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { FeedbackReplyForm } from "./reply-form";
import { FeedbackStatusForm } from "./status-form";

export const metadata = { title: "Санал хүсэлт" };

export const dynamic = "force-dynamic";

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

export default async function SystemFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, tenant: { select: { name: true } } } },
      account: { select: { name: true, phone: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!feedback) notFound();

  const submitterName = feedback.user
    ? `${feedback.user.lastName} ${feedback.user.firstName} (${feedback.user.tenant.name})`
    : feedback.account
      ? feedback.account.name?.trim() || "Үйлчлүүлэгч"
      : "—";
  const submitterPhone = feedback.user?.phone ?? feedback.account?.phone ?? null;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
      <Link href="/system/feedback" className="text-sm text-white/40 hover:text-white/70">
        ← Санал хүсэлт рүү буцах
      </Link>

      <div className="glass rounded-2xl border border-white/[0.08] p-6 mt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-white">
            {FEEDBACK_TYPE_LABEL[feedback.type]}
          </h1>
          <span className="text-xs text-white/40 tabular-nums whitespace-nowrap">
            {fmt(feedback.createdAt)}
          </span>
        </div>

        <div className="mt-4 text-sm text-white/50">
          <div>
            Илгээгч: <span className="text-white/80">{submitterName}</span>
            {submitterPhone ? (
              <span className="text-white/40"> · {formatPhone(submitterPhone)}</span>
            ) : null}
          </div>
          {feedback.pageUrl ? (
            <div className="mt-1 truncate">
              Хуудас:{" "}
              <span className="text-white/60 break-all">{feedback.pageUrl}</span>
            </div>
          ) : null}
          {feedback.userAgent ? (
            <div className="mt-1 truncate text-xs text-white/30">
              {feedback.userAgent}
            </div>
          ) : null}
        </div>

        <p className="mt-5 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/85">
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
              className="max-h-64 rounded-xl border border-white/[0.08] object-contain"
            />
          </a>
        ) : null}

        <FeedbackThread messages={feedback.messages} />

        <FeedbackReplyForm id={feedback.id} />

        <FeedbackStatusForm
          id={feedback.id}
          status={feedback.status}
          adminNote={feedback.adminNote ?? ""}
        />
      </div>
    </div>
  );
}
