import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthLayout
      headline="Grow with Eagle."
      blurb="Tell us about your farm once. We handle the supplier hunt and the back-and-forth."
    >
      <SignupForm />
    </AuthLayout>
  );
}
