import type { FeedbackStatus, FeedbackType } from "@/app/generated/prisma/client";

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  BUG: "Алдаа",
  SUGGESTION: "Санал хүсэлт",
  OTHER: "Бусад",
};

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  NEW: "Шинэ",
  IN_REVIEW: "Хянаж буй",
  RESOLVED: "Шийдэгдсэн",
  DISMISSED: "Хаагдсан",
};

export const FEEDBACK_TYPE_VALUES: FeedbackType[] = ["BUG", "SUGGESTION", "OTHER"];
export const FEEDBACK_STATUS_VALUES: FeedbackStatus[] = [
  "NEW",
  "IN_REVIEW",
  "RESOLVED",
  "DISMISSED",
];

export function isFeedbackType(v: string): v is FeedbackType {
  return (FEEDBACK_TYPE_VALUES as string[]).includes(v);
}

export function isFeedbackStatus(v: string): v is FeedbackStatus {
  return (FEEDBACK_STATUS_VALUES as string[]).includes(v);
}
