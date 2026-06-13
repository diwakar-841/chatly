import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

/** Application entry point — mounts the React tree into the root DOM node. */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1f2c33",
            color: "#fff",
            border: "1px solid #222d34",
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
