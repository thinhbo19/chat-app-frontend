import { useState, type FormEvent } from "react";
import { message } from "antd";
import { FiEye, FiEyeOff, FiUserPlus } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import {
  authEyeToggleClass,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
  authInputErrorRing,
} from "../components/auth/authUi";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import { vi } from "../strings/vi";
import { cn } from "../utils/cn";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!username.trim()) next.username = vi.register.usernameRequired;
    if (!email.trim()) next.email = vi.register.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = vi.register.emailInvalid;
    if (!password) next.password = vi.register.passwordRequired;
    else if (password.length < 6) next.password = vi.register.passwordMin;
    if (!confirmPassword) next.confirmPassword = vi.register.confirmRequired;
    else if (password !== confirmPassword) next.confirmPassword = vi.register.mismatch;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      message.success(vi.register.success);
      navigate("/login");
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, vi.register.fail));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageLayout>
      <div className="animate-auth-card-in relative z-10 w-full max-w-[420px]">
        <div className="rounded-[1.35rem] border border-white/60 bg-white/70 p-8 shadow-2xl shadow-indigo-900/15 ring-1 ring-indigo-100/90 backdrop-blur-xl sm:p-9">
          <header className="mb-8 text-center">
            <div
              className="animate-auth-float mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/35 ring-1 ring-white/40"
              aria-hidden
            >
              <FiUserPlus className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800 sm:text-[1.65rem]">
              {vi.appName}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">{vi.register.subtitle}</p>
            <h2 className="mt-6 text-lg font-semibold text-slate-800">{vi.register.title}</h2>
          </header>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="reg-username" className={authLabelClass}>
                {vi.register.username}
              </label>
              <input
                id="reg-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((s) => ({ ...s, username: "" }));
                }}
                className={cn(authInputClass, errors.username && authInputErrorRing)}
              />
              {errors.username ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.username}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="reg-email" className={authLabelClass}>
                {vi.register.email}
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((s) => ({ ...s, email: "" }));
                }}
                className={cn(authInputClass, errors.email && authInputErrorRing)}
              />
              {errors.email ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="reg-password" className={authLabelClass}>
                {vi.register.password}
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((s) => ({ ...s, password: "" }));
                  }}
                  className={cn(authInputClass, "pr-12", errors.password && authInputErrorRing)}
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

            <div>
              <label htmlFor="reg-confirm" className={authLabelClass}>
                {vi.register.confirm}
              </label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((s) => ({ ...s, confirmPassword: "" }));
                  }}
                  className={cn(
                    authInputClass,
                    "pr-12",
                    errors.confirmPassword && authInputErrorRing,
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className={authEyeToggleClass}
                  aria-label={showConfirm ? vi.login.hidePassword : vi.login.showPassword}
                >
                  {showConfirm ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword}</p>
              ) : null}
            </div>

            <button type="submit" disabled={loading} className={`${authPrimaryBtnClass} mt-2`}>
              {loading ? vi.loading : vi.register.submit}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            {vi.register.hasAccount}{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-600 underline-offset-2 transition-all duration-200 hover:text-sky-600 hover:underline"
            >
              {vi.register.loginLink}
            </Link>
          </p>
        </div>
      </div>
    </AuthPageLayout>
  );
}
