import "@fontsource/iosevka-charon-mono/latin-400.css";
import "@fontsource/iosevka-charon-mono/latin-500.css";
import "@fontsource/iosevka-charon-mono/cyrillic-400.css";
import "@fontsource/iosevka-charon-mono/cyrillic-500.css";
import "./styles.css";
import { Router } from "./router";
import { renderFolderView } from "./views/folder-view";
import { renderNoteView } from "./views/note-view";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Root element #app not found");
}

const router = new Router();

router
  .on("/", (context) => renderFolderView(app, context))
  .on("/folder/:id", (context) => renderFolderView(app, context))
  .on("/note/:id", (context) => renderNoteView(app, context))
  .fallback(() => router.navigate("/"));

router.start();
