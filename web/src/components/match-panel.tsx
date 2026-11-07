"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

export type MatchPanelItem = {
  _id: string;
  companyId: string;
  score: number;
  reasons: string[];
  selected: boolean;
  company: {
    _id: string;
    name: string;
    description: string;
    leadTimeDays: number;
    rating: number;
  } | null;
  products: Array<{
    _id: string;
    name: string;
    unit: string;
    pricePerUnit: number;
    inStock: boolean;
    checked: boolean;
  }>;
};

export function MatchPanel({
  requestId,
  initialMatches,
}: {
  requestId: string;
  initialMatches: MatchPanelItem[];
}) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(
    () =>
      new Set(
        initialMatches.filter((match) => match.selected).map((m) => m.companyId),
      ),
  );
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const match of initialMatches) {
      for (const product of match.products) {
        if (product.checked) {
          ids.add(product._id);
        }
      }
    }
    return ids;
  });

  const selectedCount = selectedCompanies.size;

  const ranked = useMemo(
    () => [...matches].sort((a, b) => b.score - a.score),
    [matches],
  );

  async function findSuppliers() {
    setFinding(true);
    try {
      await api(`/api/requests/${requestId}/match`, { method: "POST" });
      const result = await api<{ matches: MatchPanelItem[] }>(
        `/api/requests/${requestId}/matches`,
      );
      setMatches(result.matches);
      setSelectedCompanies(new Set());
      setSelectedProducts(new Set());
      toast.success(
        result.matches.length > 0
          ? `Found ${result.matches.length} suppliers`
          : "No suppliers matched your request",
      );
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? ((error.body as { error?: { message?: string } } | undefined)?.error
              ?.message ?? error.message)
          : "Matching failed";
      toast.error(message);
    } finally {
      setFinding(false);
    }
  }

  function toggleCompany(companyId: string, checked: boolean) {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(companyId);
      } else {
        next.delete(companyId);
      }
      return next;
    });
  }

  function toggleProduct(
    companyId: string,
    productId: string,
    checked: boolean,
  ) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
    if (checked) {
      setSelectedCompanies((prev) => new Set(prev).add(companyId));
    }
  }

  async function saveSelections() {
    setSaving(true);
    try {
      await api(`/api/requests/${requestId}/matches`, {
        method: "PATCH",
        body: {
          companyIds: [...selectedCompanies],
          productIds: [...selectedProducts],
        },
      });
      toast.success("Selections saved");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? ((error.body as { error?: { message?: string } } | undefined)?.error
              ?.message ?? error.message)
          : "Could not save selections";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={findSuppliers} disabled={finding}>
          {finding ? "Finding…" : "Find suppliers"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={saveSelections}
          disabled={saving || matches.length === 0}
        >
          {saving ? "Saving…" : "Save selections"}
        </Button>
        <Button asChild disabled={selectedCount === 0}>
          <Link
            href={
              selectedCount === 0
                ? `#`
                : `/requests/${requestId}/emails`
            }
            aria-disabled={selectedCount === 0}
            onClick={(event) => {
              if (selectedCount === 0) {
                event.preventDefault();
              }
            }}
          >
            Continue to emails
          </Link>
        </Button>
      </div>

      {ranked.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matches yet</CardTitle>
            <CardDescription>
              Run “Find suppliers” to score companies with the rule-based
              matcher.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {ranked.map((match) => {
            const companyId = match.companyId;
            const companyChecked = selectedCompanies.has(companyId);
            return (
              <Card key={match._id}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={companyChecked}
                          onChange={(event) =>
                            toggleCompany(companyId, event.target.checked)
                          }
                          aria-label={`Select ${match.company?.name ?? "company"}`}
                        />
                        {match.company?.name ?? "Unknown company"}
                      </CardTitle>
                      <CardDescription>
                        Score {match.score}/100 · lead time{" "}
                        {match.company?.leadTimeDays ?? "?"} days · rating{" "}
                        {match.company?.rating ?? "?"}/5
                      </CardDescription>
                    </div>
                  </div>
                  <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                    {match.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </CardHeader>
                <CardContent className="space-y-2">
                  {match.products.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No catalog products for this service.
                    </p>
                  ) : (
                    match.products.map((product) => (
                      <label
                        key={product._id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          checked={selectedProducts.has(product._id)}
                          onChange={(event) =>
                            toggleProduct(
                              companyId,
                              product._id,
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <span className="font-medium">{product.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · ${product.pricePerUnit}/{product.unit}
                            {product.inStock ? "" : " · out of stock"}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
