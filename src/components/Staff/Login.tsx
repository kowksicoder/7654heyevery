import { LockClosedIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, ErrorMessage, Input } from "@/components/Shared/UI";
import { staffAdminSignIn } from "@/helpers/staff";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { setStaffAdminSession } from "@/store/persisted/useStaffAdminStore";

const StaffLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!hasSupabaseConfig()) {
      setError(new Error("Supabase is not configured."));
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(new Error("Enter your admin email and password."));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const session = await staffAdminSignIn(email, password);
      setStaffAdminSession(session);
      toast.success("Admin access granted");
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("Admin login failed.");

      setError(nextError);
      toast.error(nextError.message || "Admin login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 md:px-0">
      <Card className="p-5 md:p-6" forceRounded>
        <div className="space-y-5">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldCheckIcon className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-semibold text-2xl text-gray-950 tracking-tight dark:text-gray-50">
                Admin login
              </h1>
              <p className="text-gray-500 text-sm dark:text-gray-400">
                Sign in with an allowlisted admin email to access Every1 staff
                tools.
              </p>
            </div>
          </div>

          {error ? (
            <ErrorMessage error={error} title="Could not sign in" />
          ) : null}

          <div className="space-y-3">
            <Input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Admin email"
              type="email"
              value={email}
            />
            <Input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
          </div>

          <Button
            className="w-full"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            <LockClosedIcon className="size-4" />
            {isSubmitting ? "Signing in..." : "Enter admin panel"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default StaffLogin;
