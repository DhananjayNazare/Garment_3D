import { useGLTF } from "@react-three/drei";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { EditorPage } from "./routes/EditorPage";

// Configure Draco decoder path once at startup for all useGLTF() calls.
useGLTF.setDecoderPath("/draco/");

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
