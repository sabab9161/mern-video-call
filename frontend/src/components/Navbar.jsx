import { LogOut, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-gray-950">
          <Video className="h-5 w-5" />
          MeetMERN
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">{user.name}</span>
            <button
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-50"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
