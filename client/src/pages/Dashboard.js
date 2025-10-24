import React, { useEffect, useState } from "react";

export default function Dashboard() {
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(() => setStatus("Backend not connected ❌"));
  }, []);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">📈 Dashboard</h1>
      <p>Status: {status}</p>
    </div>
  );
}