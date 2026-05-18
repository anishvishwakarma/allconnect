import { useEffect, useRef } from "react";
import { useAlert } from "../context/AlertContext";
import { maybePromptAppUpdate } from "../services/appUpdate";

/** Once per cold start: compare installed version with /api/app/version and prompt if outdated. */
export function useAppUpdateCheck() {
  const alert = useAlert();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const t = setTimeout(() => {
      void maybePromptAppUpdate(alert.show);
    }, 800);
    return () => clearTimeout(t);
  }, [alert]);
}
