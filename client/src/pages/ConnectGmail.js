import React, { useState } from "react";

export default function ConnectGmail() {
  const [authUrl, setAuthUrl] = useState("");

  const handleConnect = async () => {
    const res = await fetch("/authorize");
    const data = await res.json();
    setAuthUrl(data.url);
    window.location.href = data.url; // redirect to Google OAuth
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Connect Your Gmail</h1>
      <p className="mb-4 text-gray-600">
        Allow access to your Gmail inbox so we can monitor incoming messages.
      </p>
      <button
        onClick={handleConnect}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow"
      >
        Connect Gmail
      </button>
    </div>
  );
}