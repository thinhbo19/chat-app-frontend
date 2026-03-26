import type { ReactNode } from "react";

type AuthPageLayoutProps = {
  children: ReactNode;
};

/**
 * Nền full-screen xanh biển nhạt + trắng (gần gradient app ban đầu).
 */
export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div
      className="relative flex min-h-dvh w-full flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 px-4 py-8 sm:px-6"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_15%_10%,rgba(56,189,248,0.35),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_85%,rgba(59,130,246,0.22),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl"
        aria-hidden
      />
      {children}
    </div>
  );
}
