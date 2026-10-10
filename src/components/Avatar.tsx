import type { User } from "@/types";

/** Circle with the first letter of the name; falls back to a generic person icon when there is no name. */
export default function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const initial = user.full_name?.trim().charAt(0);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-teal-soft font-semibold text-teal"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden
    >
      {initial ? (
        initial
      ) : (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )}
    </span>
  );
}
