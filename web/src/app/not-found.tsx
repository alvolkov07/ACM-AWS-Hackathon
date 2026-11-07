import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageContainer className="space-y-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        That URL does not match any page in this app. Double-check the path or
        head back home.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </PageContainer>
  );
}
