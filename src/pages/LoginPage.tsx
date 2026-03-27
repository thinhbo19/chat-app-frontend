import { useState, type FormEvent } from "react";
import { message } from "antd";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { SiGithub, SiGoogle } from "react-icons/si";
import { Link, useNavigate } from "react-router-dom";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import {
  authEyeToggleClass,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
  authSocialBtnClass,
  authInputErrorRing,
} from "../components/auth/authUi";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";
import { cn } from "../utils/cn";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ emailOrUsername?: string; password?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (!emailOrUsername.trim()) {
      next.emailOrUsername = vi.login.emailRequired;
    }
    if (!password) {
      next.password = vi.login.passwordRequired;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      await login({ emailOrUsername: emailOrUsername.trim(), password });
      message.success(vi.login.success);
      navigate("/chat");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.login.fail));
    } finally {
      setLoading(false);
    }
  }

  function onSocialClick(provider: "google" | "github") {
    void provider;
    message.info(vi.login.socialComingSoon);
  }

  return (
    <AuthPageLayout>
      <div className="animate-auth-card-in relative z-10 w-full max-w-[420px]">
        <div className="rounded-[1.35rem] border border-white/60 bg-white/70 p-8 shadow-2xl shadow-indigo-900/15 ring-1 ring-indigo-100/90 backdrop-blur-xl sm:p-9">
          <header className="mb-8 text-center">
            <div
              className="animate-auth-float mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-3xl text-white shadow-lg shadow-indigo-500/35 ring-1 ring-white/40"
              aria-hidden
            >
              💬
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800 sm:text-[1.65rem]">
              {vi.appName}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">{vi.login.saasTagline}</p>
            <h2 className="mt-6 text-lg font-semibold text-slate-800">{vi.login.title}</h2>
          </header>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div>
              <label htmlFor="login-email" className={authLabelClass}>
                {vi.login.emailLabel}
              </label>
              <input
                id="login-email"
                name="emailOrUsername"
                type="text"
                autoComplete="username"
                value={emailOrUsername}
                onChange={(e) => {
                  setEmailOrUsername(e.target.value);
                  if (errors.emailOrUsername) setErrors((s) => ({ ...s, emailOrUsername: undefined }));
                }}
                placeholder="you@email.com"
                className={cn(authInputClass, errors.emailOrUsername && authInputErrorRing)}
              />
              {errors.emailOrUsername ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.emailOrUsername}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="login-password" className={authLabelClass}>
                {vi.login.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((s) => ({ ...s, password: undefined }));
                  }}
                  className={cn(
                    authInputClass,
                    "pr-12",
                    errors.password && authInputErrorRing,
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className={authEyeToggleClass}
                  aria-label={showPassword ? vi.login.hidePassword : vi.login.showPassword}
                >
                  {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password}</p>
              ) : null}
            </div>

            <button type="submit" disabled={loading} className={authPrimaryBtnClass}>
              {loading ? vi.loading : vi.login.submit}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-sky-200/80" />
            </div>
            <div className="relative flex justify-center text-xs font-medium uppercase tracking-wider">
              <span className="bg-white/90 px-3 text-slate-400 backdrop-blur-sm">
                {vi.login.dividerOr}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => onSocialClick("google")} className={authSocialBtnClass}>
              <SiGoogle className="h-5 w-5 text-slate-700" aria-hidden />
              {vi.login.continueGoogle}
            </button>
            <button type="button" onClick={() => onSocialClick("github")} className={authSocialBtnClass}>
              <SiGithub className="h-5 w-5 text-slate-700" aria-hidden />
              {vi.login.continueGithub}
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            {vi.login.noAccount}{" "}
            <Link
              to="/register"
              className="font-semibold text-blue-600 underline-offset-2 transition-all duration-200 hover:text-sky-600 hover:underline"
            >
              {vi.login.registerLink}
            </Link>
          </p>
        </div>
      </div>
    </AuthPageLayout>
  );
}
