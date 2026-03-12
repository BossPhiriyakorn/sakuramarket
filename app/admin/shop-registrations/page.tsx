"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CmsShopRegistrationsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/shops");
  }, [router]);
  return (
    <div className="p-6 md:p-8 text-slate-400 text-sm">
      กำลังนำทางไปร้านค้า...
    </div>
  );
}
