import { useLocale } from "./i18n/react";
// Compatibility entry for QMuse source imports. The application uses file routes.
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
const router = getRouter();
export default function App() {
  useLocale();

  return <RouterProvider router={router} />;
}
