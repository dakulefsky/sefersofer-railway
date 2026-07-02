import { useState } from "react";
import { useLocation } from "wouter";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type AuthMode = "login" | "register" | "forgot-password";

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      navigate("/");
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabaseBrowser.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || JSON.stringify(signUpError));
        console.error("Signup error:", signUpError);
        return;
      }

      if (!data.user) {
        setError("Registration failed: No user created");
        return;
      }

      setSuccess("Registration successful! Check your email to confirm.");
      setEmail("");
      setPassword("");
      setTimeout(() => setMode("login"), 2000);
    } catch (err: any) {
      setError(err?.message || JSON.stringify(err) || "An unexpected error occurred");
      console.error("Signup exception:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabaseBrowser.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth?mode=reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess("Password reset link sent to your email!");
      setEmail("");
      setTimeout(() => setMode("login"), 3000);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    switch (mode) {
      case "login":
        handleLogin(e);
        break;
      case "register":
        handleRegister(e);
        break;
      case "forgot-password":
        handleForgotPassword(e);
        break;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <Card className="w-full max-w-md shadow-lg border-stone-200">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">
              SeferSofer
            </h1>
            <p className="text-stone-600">
              {mode === "login" && "Sign in to your account"}
              {mode === "register" && "Create a new account"}
              {mode === "forgot-password" && "Reset your password"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={loading}
                className="w-full"
              />
            </div>

            {mode !== "forgot-password" && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {loading ? "Loading..." : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Link"}
            </Button>
          </form>

          {/* Mode Toggle */}
          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === "login" && (
              <>
                <button
                  onClick={() => {
                    setMode("forgot-password");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="block w-full text-teal-600 hover:text-teal-700 font-medium"
                >
                  Forgot password?
                </button>
                <div className="text-stone-600">
                  Don't have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("register");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Sign up
                  </button>
                </div>
              </>
            )}

            {mode === "register" && (
              <div className="text-stone-600">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  Sign in
                </button>
              </div>
            )}

            {mode === "forgot-password" && (
              <div className="text-stone-600">
                Remember your password?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
