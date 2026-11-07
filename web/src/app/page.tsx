import Link from "next/link";

import { ApiStatusCard } from "@/components/api-status-card";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <PageContainer className="space-y-10">
      <section className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Eagle</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
          A simple SaaS starter for an AWS hackathon
        </h1>
        <p className="max-w-xl text-muted-foreground">
          This home page is intentionally small. Later stages add auth, a
          database, file uploads, and AWS hosting — one piece at a time.
        </p>
        <Button asChild>
          <Link href="/login">Get started</Link>
        </Button>
      </section>

      <ApiStatusCard />
    </PageContainer>
  );
}
