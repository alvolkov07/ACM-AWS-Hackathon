"use client";

import { useEffect } from "react";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Surface the error in the browser console for local debugging.
    console.error(error);
  }, [error]);

  return (
    <PageContainer className="space-y-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        An unexpected error occurred while rendering this page. You can try
        again, or refresh if the problem continues.
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </PageContainer>
  );
}
