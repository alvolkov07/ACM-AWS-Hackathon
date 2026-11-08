import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import LocationForm from "@/components/auth/LocationForm";

export const metadata: Metadata = { title: "Farm location" };

export default function SetupLocationPage() {
  return (
    <AuthLayout
      headline="One last thing."
      blurb="Tell us where you farm and we will match you with suppliers who serve your area."
    >
      <LocationForm />
    </AuthLayout>
  );
}
