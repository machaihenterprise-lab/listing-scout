import React from "react";
import { cookies } from "next/headers";
import LoginForm from "./LoginForm";
import Actions from "./Actions";
import dynamic from "next/dynamic";

const DashboardDailyTasks = dynamic(
  () => import("../../DashboardDaily/Tasks").then((m) => m.DashboardDailyTasks),
  { ssr: false }
);

type DeliveryError = {
  id: string;
  lead_id: string | null;
  to_phone: string | null;
  provider: string | null;
  status_code: number | null;
  error_text: string | null;
  created_at: string | null;
};

export default async function Page() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // simple cookie-based protection: user must sign in via the login form to get cookie
  const ck = await cookies();
  const isAdmin = Boolean(ck.get("listing_scout_admin"));

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Delivery Errors — Admin</h2>
        <p className="mt-2 text-sm text-gray-600">Sign in to view delivery errors.</p>
        <LoginForm />
      </div>
    );
  }

  if (!supabaseUrl || !serviceKey) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Delivery Errors</h2>
        <p className="mt-2 text-sm text-red-600">Supabase configuration missing.</p>
      </div>
    );
  }

  const url = `${supabaseUrl}/rest/v1/delivery_errors?select=id,lead_id,to_phone,provider,status_code,error_text,created_at&order=created_at.desc&limit=50`;

  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Delivery Errors</h2>
        <p className="mt-2 text-sm text-red-600">Failed to fetch: {text}</p>
      </div>
    );
  }

  const rows: DeliveryError[] = await res.json().catch(() => []);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Recent Delivery Errors</h2>
      <p className="mt-2 text-sm text-gray-600">Showing the latest 50 delivery error records.</p>

      <Actions />
      <div className="mt-6">
        <DashboardDailyTasks />
      </div>

      <div className="mt-4 overflow-auto">
        <table className="w-full text-sm table-auto border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Lead ID</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Provider</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4 align-top">{r.created_at ?? "-"}</td>
                <td className="py-2 pr-4 align-top"><code>{r.lead_id ?? "-"}</code></td>
                <td className="py-2 pr-4 align-top">{r.to_phone ?? "-"}</td>
                <td className="py-2 pr-4 align-top">{r.provider ?? "-"}</td>
                <td className="py-2 pr-4 align-top">{r.status_code ?? "-"}</td>
                <td className="py-2 pr-4 align-top"><pre className="whitespace-pre-wrap">{r.error_text ?? "-"}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
