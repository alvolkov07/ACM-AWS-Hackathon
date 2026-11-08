import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthLayout
      headline="Welcome back to the field."
      blurb="Your suppliers, drafts and replies are right where you left them."
    >
      <LoginForm />
    </AuthLayout>
  );
}
