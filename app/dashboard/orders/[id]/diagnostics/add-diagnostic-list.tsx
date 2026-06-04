"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  type AddOrderDiagnosticState,
  addOrderDiagnosticAction,
} from "@/app/_actions/orders";
import { useToast } from "@/app/_components/toast";
import {
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_TYPE_BADGE,
  DIAGNOSTIC_TYPE_DESCRIPTION,
  DIAGNOSTIC_TYPE_LABEL,
  type DiagnosticType,
} from "@/lib/diagnostics";

type Template = {
  id: string;
  name: string;
  description: string | null;
  type: string;
};

export function AddDiagnosticList({
  orderId,
  templates,
}: {
  orderId: string;
  templates: Template[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, pending] = useActionState<
    AddOrderDiagnosticState,
    FormData
  >(addOrderDiagnosticAction, null);

  const handled = useRef<AddOrderDiagnosticState>(null);
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.status === "added") {
      toast.success(state.message);
      router.push(`/dashboard/orders/${orderId}`);
    } else if (state.status === "duplicate") {
      toast.show({ message: state.message, kind: "warning" });
    } else {
      toast.error(state.message);
    }
  }, [state, toast, router, orderId]);

  const byType: Record<DiagnosticType, Template[]> = {
    INTAKE: [],
    POST_SERVICE: [],
    ROUTINE: [],
    DAMAGE_REPORT: [],
  };
  for (const t of templates) {
    byType[t.type as DiagnosticType].push(t);
  }

  return (
    <div className="flex flex-col gap-5">
      {DIAGNOSTIC_TYPES.map((tp) => {
        const list = byType[tp];
        if (list.length === 0) return null;
        return (
          <section
            key={tp}
            className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            <div className="px-5 py-3 flex items-center gap-3 border-b border-white/[0.06]">
              <span
                className={`text-xs px-2.5 py-1 rounded-full ${DIAGNOSTIC_TYPE_BADGE[tp]}`}
              >
                {DIAGNOSTIC_TYPE_LABEL[tp]}
              </span>
              <span className="text-xs text-white/40">
                {DIAGNOSTIC_TYPE_DESCRIPTION[tp]}
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {list.map((t) => (
                <form
                  key={t.id}
                  action={formAction}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="templateId" value={t.id} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/90">
                      {t.name}
                    </div>
                    {t.description ? (
                      <div className="text-xs text-white/40 mt-0.5">
                        {t.description}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="shrink-0 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg font-medium"
                  >
                    + Нэмэх
                  </button>
                </form>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
