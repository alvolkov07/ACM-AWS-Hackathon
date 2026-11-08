import type { Metadata } from "next";
import Dashboard from "@/components/app/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <Dashboard />;
}
