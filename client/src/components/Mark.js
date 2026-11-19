import { useId } from "react";

// LISAP's mark: a heart with a keyhole cut through it.
export default function Mark({ size = 28, className }) {
  const id = `keyhole-${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <mask id={id}>
          <rect width="24" height="24" fill="#fff" />
          <circle cx="12" cy="10.2" r="2.1" fill="#000" />
          <path d="M11 11.4h2l.7 4.3h-3.4z" fill="#000" />
        </mask>
      </defs>
      <path
        mask={`url(#${id})`}
        fill="currentColor"
        d="M12 21C5.8 16.6 2 13.1 2 8.8 2 5.8 4.3 3.5 7.2 3.5c1.9 0 3.6 1 4.8 2.6 1.2-1.6 2.9-2.6 4.8-2.6 2.9 0 5.2 2.3 5.2 5.3 0 4.3-3.8 7.8-10 12.2z"
      />
    </svg>
  );
}
