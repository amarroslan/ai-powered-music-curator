import { Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import QuizPage from "./pages/QuizPage";
import GeneratingPage from "./pages/GeneratingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/generating" element={<GeneratingPage />} />
    </Routes>
  );
}
