import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="flex gap-4 bg-gray-100 p-4 shadow">
      <Link to="/">Dashboard</Link>
      <Link to="/connect">Connect Gmail</Link>
    </nav>
  );
}