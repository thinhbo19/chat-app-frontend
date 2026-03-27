import type { ReactNode } from "react";

type AuthPageLayoutProps = {
  children: ReactNode;
};

/**
 * Nền đăng nhập / đăng ký — mesh indigo + cyan khớp giao diện chat.
 */
export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div
      className="relative flex min-h-dvh w-full flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-100 via-violet-50 to-cyan-50 px-4 py-8 sm:px-6"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_10%_5%,rgba(99,102,241,0.38),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_92%_88%,rgba(6,182,212,0.28),transparent_48%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-violet-300/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-cyan-200/35 blur-3xl"
        aria-hidden
      />
      {children}
    </div>
  );
}
