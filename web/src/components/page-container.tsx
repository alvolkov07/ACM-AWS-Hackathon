import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

/** Shared content width so pages line up with the nav and footer. */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl flex-1 px-4 py-10", className)}>
      {children}
    </div>
  );
}
