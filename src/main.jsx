import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Landing from "./pages/Landing.jsx";
import Host from "./pages/Host.jsx";
import Play from "./pages/Play.jsx";
import Admin from "./pages/Admin.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<Host />} />
        <Route path="/play" element={<Play />} />
        <Route path="/admin/mauritius" element={<Admin club="mauritius" />} />
        <Route path="/admin/tgswadi" element={<Admin club="tgswadi" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
