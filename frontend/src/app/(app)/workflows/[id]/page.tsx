import type { Metadata } from "next";
import WorkflowView from "@/components/workflow/WorkflowView";

export const metadata: Metadata = { title: "Request" };

export default function WorkflowPage() {
  return <WorkflowView />;
}
