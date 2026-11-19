import { Link, useLocation, useNavigate } from "react-router-dom";
import Mark from "./Mark";
import { useAuth, signOutUser } from "../lib/auth";

export default function Header() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOutUser();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link to="/" className="brand" aria-label="LISAP home">
          <Mark className="brand-mark" />
          <span translate="no">LISAP</span>
        </Link>
        <nav className="header-nav" aria-label="Account">
          {!loading && user && (
            <>
              {pathname !== "/dashboard" && (
                <Link className="nav-link" to="/dashboard">
                  Dashboard
                </Link>
              )}
              <button type="button" className="nav-link" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          )}
          {!loading && !user && pathname !== "/login" && !pathname.startsWith("/join") && (
            <Link className="nav-link" to="/login">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
