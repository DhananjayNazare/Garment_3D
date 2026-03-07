import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { EditorPage } from "./routes/EditorPage";

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
