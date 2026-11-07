"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Field, SelectControl } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { SERVICE_LABELS } from "@/lib/db/schemas/service-labels";
import { SERVICE_TYPES } from "@/lib/db/schemas/service-type";

type ProfileResponse = {
  profile: {
    _id: string;
  };
};

export function ProfileForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const deliveryTarget = String(formData.get("deliveryTarget") ?? "");
      await api<ProfileResponse>("/api/profile", {
        method: "POST",
        body: {
          companyName: String(formData.get("companyName") ?? "").trim(),
          address: String(formData.get("address") ?? "").trim(),
          state: String(formData.get("state") ?? "").trim(),
          deliveryTarget,
          defaultService: String(formData.get("defaultService") ?? ""),
        },
      });
      toast.success("Buyer profile created");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? ((error.body as { error?: { message?: string } } | undefined)?.error
              ?.message ?? error.message)
          : "Could not save profile";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label="Company / Name" htmlFor="companyName">
        <Input id="companyName" name="companyName" required />
      </Field>
      <Field label="Address" htmlFor="address">
        <Input id="address" name="address" required />
      </Field>
      <Field label="State" htmlFor="state" hint="Two-letter US code, e.g. CA">
        <Input
          id="state"
          name="state"
          maxLength={2}
          placeholder="CA"
          required
        />
      </Field>
      <Field label="Delivery target" htmlFor="deliveryTarget">
        <Input id="deliveryTarget" name="deliveryTarget" type="date" required />
      </Field>
      <Field label="Select service" htmlFor="defaultService">
        <SelectControl id="defaultService" name="defaultService" required defaultValue="">
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
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create agent profile"}
      </Button>
    </form>
  );
}
