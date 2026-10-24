import { createRoot } from "react-dom/client";
import App from "./App";
import "../../../src/workbench.css";
import "../../../src/war-thunder.css";
import "../../../src/research-tree-game.css";
import "../../../src/game-select.css";
import "./styles.css";
createRoot(document.getElementById("app")!).render(<App />);
