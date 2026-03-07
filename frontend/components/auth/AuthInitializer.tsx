"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

export function AuthInitializer() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
}
