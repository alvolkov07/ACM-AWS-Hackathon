import { PageContainer } from "@/components/page-container";
import { ProfileForm } from "@/components/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBuyerProfileForUser } from "@/lib/db/repositories/buyer-profiles";

export default async function ProfilePage() {
  const user = getCurrentUser();
  const profile = await getBuyerProfileForUser(user.userId);

  return (
    <PageContainer className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Create Agent</h1>
        <p className="text-muted-foreground">
          Tell us about your farm or agri-business so we can match suppliers.
        </p>
      </div>

      {profile ? (
        <Card>
          <CardHeader>
            <CardTitle>{profile.companyName}</CardTitle>
            <CardDescription>
              {profile.address}, {profile.state} · delivery by{" "}
              {profile.deliveryTarget.toISOString().slice(0, 10)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Profile editing comes later. You can open new requests from the
            dashboard.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Buyer profile</CardTitle>
            <CardDescription>
              Company / name, address, state, and delivery target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
