import { Navigate, createFileRoute } from "@tanstack/react-router";
import { guidesEnabled } from "../features";
export const Route = createFileRoute("/")({ codeSplitGroupings: [], component: Index });
function Index() {
  return guidesEnabled() ? (
    <Navigate to="/maps" search={{ map: undefined, side: undefined }} replace />
  ) : (
    <Navigate to="/tree" replace />
  );
}
