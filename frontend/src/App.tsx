import { BrowserRouter, Link, Route, Routes, NavLink } from "react-router-dom";
import TaskListPage from "./pages/TaskListPage";
import TaskCreationPage from "./pages/TaskCreationPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="app-title">
            Task Assignment
          </Link>
          <nav className="app-nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Task List
            </NavLink>
            <NavLink to="/new" className={({ isActive }) => (isActive ? "active" : "")}>
              New Task
            </NavLink>
          </nav>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<TaskListPage />} />
            <Route path="/new" element={<TaskCreationPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
