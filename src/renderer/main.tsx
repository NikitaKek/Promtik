import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import MiniRecorder from "./MiniRecorder";
import "./styles.css";

const view = new URLSearchParams(window.location.search).get("view");
const Root = view === "mini" ? MiniRecorder : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
