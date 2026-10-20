import { Navigate, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ codeSplitGroupings: [], component: Index });
function Index() {
  return <Navigate to="/tree" replace />;
}
