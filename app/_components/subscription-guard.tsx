"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const SUBSCRIPTION_PATH = "/dashboard/settings/subscription";

/**
 * Багц дууссан (locked) үед тенантын OWNER-ийг subscription page руу автоматаар
 * чиглүүлнэ (тэндээс л төлбөр төлж сунгана). Ажилтан (owner биш) нь төлбөр төлж
 * чадахгүй тул чиглүүлэхгүй — зүгээр banner + read-only хэвээр үлдээнэ.
 */
export function SubscriptionGuard({
  locked,
  isOwner,
}: {
  locked: boolean;
  isOwner: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (locked && isOwner && !pathname.startsWith(SUBSCRIPTION_PATH)) {
      router.replace(SUBSCRIPTION_PATH);
    }
  }, [locked, isOwner, pathname, router]);

  return null;
}
