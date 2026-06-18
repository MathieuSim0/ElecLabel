// Router principal — HashRouter pour Capacitor (file:// scheme).
// Toutes les routes sont protégées par AuthGate.
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Templates from "./pages/Templates";
import History from "./pages/History";
import Editor from "./pages/Editor";
import Preview from "./pages/Preview";
import Invoices from "./pages/Invoices";
import Stock from "./pages/Stock";
import AuthGate from "./components/AuthGate";
import VoltAssistant from "./components/VoltAssistant";

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/history" element={<History />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <VoltAssistant />
    </AuthGate>
  );
}
