import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CartPage } from "./pages/CartPage";
import { Channel3Shop } from "./pages/Channel3Shop";
import { Landing } from "./pages/Landing";
import { Workspace } from "./pages/Workspace";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Workspace />} />
        <Route path="/discover" element={<Channel3Shop />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
