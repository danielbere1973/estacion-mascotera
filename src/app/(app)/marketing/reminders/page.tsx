import { requireAdmin } from "@/lib/permissions";

export default async function RemindersPage() {
  await requireAdmin();

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Marketing — Reminders</h1>
    </div>
  );
}
