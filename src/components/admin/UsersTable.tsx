"use client";

import { useState } from "react";

interface UserRow {
  id: string; email: string; name: string; accountNo: string;
  isAdmin: boolean; verified: boolean;
  balance: number; equity: number; floatingPl: number; createdAt: string;
}

/** Admin users table: search, balance/equity, verified status. */
export function UsersTable({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.accountNo.includes(q);
  });

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email, or account #"
        className="w-full max-w-md h-9 mb-4 bg-canvas border border-border rounded px-3 text-sm outline-none focus:border-brand placeholder:text-text-faint"
      />

      <div className="bg-canvas border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-panel-2 border-b border-border">
            <tr>
              <Th>Name</Th>
              <Th>Account</Th>
              <Th className="text-right">Balance</Th>
              <Th className="text-right">Equity</Th>
              <Th className="text-right">Floating P/L</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border-soft hover:bg-panel-2">
                <Td>
                  <div className="font-medium">{u.name}{u.isAdmin && <span className="ml-1.5 text-[10px] text-brand">★</span>}</div>
                  <div className="text-[11px] text-text-faint">{u.email}</div>
                </Td>
                <Td className="tnum text-text-muted">#{u.accountNo}</Td>
                <Td className="text-right tnum">${u.balance.toFixed(2)}</Td>
                <Td className="text-right tnum">${u.equity.toFixed(2)}</Td>
                <Td className={`text-right tnum ${u.floatingPl >= 0 ? "text-up" : "text-down"}`}>
                  {u.floatingPl >= 0 ? "+" : ""}{u.floatingPl.toFixed(2)}
                </Td>
                <Td>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.verified ? "bg-up/15 text-up" : "bg-panel-2 text-text-muted"}`}>
                    {u.verified ? "Verified" : "Unverified"}
                  </span>
                </Td>
                <Td className="text-text-muted tnum text-[11px]">{new Date(u.createdAt).toLocaleDateString("en-GB")}</Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-faint text-xs">No users match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium text-text-faint text-[10px] uppercase px-3 py-2 whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-xs whitespace-nowrap ${className}`}>{children}</td>;
}
