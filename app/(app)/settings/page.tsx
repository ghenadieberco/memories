import { requireProfile } from "@/lib/profile";
import { ChangePasswordForm, DisplayNameForm } from "./settings-forms";
import { OptimizationSetting } from "./optimization-setting";

export const metadata = { title: "Settings · Memories" };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireProfile();

  return (
    <>
      <h1 className="font-display text-[30px] font-bold text-ink">Settings</h1>

      <div className="mt-6 flex flex-col gap-4">
        {/* FR-PROF-1 / FR-PROF-5: identity, with non-editable fields read-only. */}
        <section className="glass rounded-[26px] p-[22px]">
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Your profile
          </h2>

          <div className="mt-4">
            <span className="lbl">Email</span>
            <p className="text-[14.5px] text-ink">{user.email}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Your email can&apos;t be changed.
            </p>
          </div>

          <div className="mt-5">
            <DisplayNameForm defaultName={user.name} />
          </div>
        </section>

        <section className="glass rounded-[26px] p-[22px]">
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Password
          </h2>
          <ChangePasswordForm />
        </section>

        <OptimizationSetting />
      </div>
    </>
  );
}
