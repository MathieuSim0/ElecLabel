// Router principal — toutes les routes sont protégées par AuthGate.
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import Preview from "./pages/Preview";
import Templates from "./pages/Templates";
import History from "./pages/History";
import Invoices from "./pages/Invoices";
import AuthGate from "./components/AuthGate";
import UpdateBanner from "./components/UpdateBanner";
import VoltAssistant from "./components/VoltAssistant";

export default function App() {
  return (
    <BrowserRouter>
      <UpdateBanner />
      <AuthGate>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/history" element={<History />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <VoltAssistant />
      </AuthGate>
    </BrowserRouter>
  );
}
