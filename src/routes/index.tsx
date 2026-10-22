import { useLocale } from "../i18n/react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ codeSplitGroupings: [], component: Index });
function Index() {
  useLocale();

  // Keep old map landing links working; map pages themselves are always public.
  return new URLSearchParams(location.search).get("guides") === "1" ? (
    <Navigate to="/maps" search={{ map: undefined, side: undefined }} replace />
  ) : (
    <Navigate to="/tree" replace />
  );
}
