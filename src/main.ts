import "./styles.css";
import { ApiClient } from "./api/client";
import { WebsiteShell } from "./app";
import { Router } from "./routing/router";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Website root element is missing");
const shell = new WebsiteShell(root, new ApiClient(), new Router());
shell.start();
window.addEventListener("pagehide", () => shell.stop(), { once: true });
