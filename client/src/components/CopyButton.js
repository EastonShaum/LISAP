import { useEffect, useRef, useState } from "react";

// Copies `text`; the label changes to "Copied" for two seconds and is announced.
export default function CopyButton({ text, label = "Copy", className = "btn btn-quiet btn-small" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
