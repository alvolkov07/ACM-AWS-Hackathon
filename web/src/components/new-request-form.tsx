"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Field, SelectControl, TextareaControl } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { SERVICE_LABELS } from "@/lib/db/schemas/service-labels";
import { SERVICE_TYPES, type ServiceType } from "@/lib/db/schemas/service-type";

type CreateResponse = {
  request: { _id: string };
};

export function NewRequestForm({
  defaultService,
}: {
  defaultService?: ServiceType;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const quantityRaw = String(formData.get("quantity") ?? "").trim();
      const body: {
        service: string;
        prompt: string;
        notes?: string;
        quantity?: number;
      } = {
        service: String(formData.get("service") ?? ""),
        prompt: String(formData.get("prompt") ?? "").trim(),
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      };
      if (quantityRaw) {
        body.quantity = Number(quantityRaw);
      }

      const result = await api<CreateResponse>("/api/requests", {
        method: "POST",
        body,
      });
      toast.success("Request created");
      router.push(`/requests/${result.request._id}`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? ((error.body as { error?: { message?: string } } | undefined)?.error
              ?.message ?? error.message)
          : "Could not create request";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label="What do you need?" htmlFor="prompt">
        <TextareaControl
          id="prompt"
          name="prompt"
          required
          placeholder="Describe the service, acreage, timing, and any constraints…"
        />
      </Field>
      <Field label="Service" htmlFor="service">
        <SelectControl
          id="service"
          name="service"
          required
          defaultValue={defaultService ?? ""}
        >
          <option value="" disabled>
            Choose a service
          </option>
          {SERVICE_TYPES.map((service) => (
            <option key={service} value={service}>
              {SERVICE_LABELS[service]}
            </option>
          ))}
        </SelectControl>
      </Field>
      <Field label="Quantity (optional)" htmlFor="quantity">
        <Input id="quantity" name="quantity" type="number" min={1} step="any" />
      </Field>
      <Field label="Notes (optional)" htmlFor="notes">
        <Input id="notes" name="notes" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create request"}
      </Button>
    </form>
  );
}
