import { DemoBanner } from "@/components/DemoBanner";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  History,
  LogOut,
  ReceiptText,
  ShieldCheck,
  ToggleRight,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { cn } from "@/lib/utils";

const NAV = [
  {
    section: "Tools",
    items: [
      { to: "/kyc", label: "KYC Review", icon: ShieldCheck },
      { to: "/refunds", label: "Refunds", icon: ReceiptText },
      { to: "/flags", label: "Feature Flags", icon: ToggleRight },
    ],
  },
  {
    section: "Platform",
    items: [{ to: "/audit", label: "Audit Log", icon: History }],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function AppLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r bg-sidebar">
        <div className="flex items-center gap-2 px-4 py-5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">OpsDash</span>
        </div>
        <Separator />
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.section}
              </p>
              <ul className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                          isActive && "bg-accent font-medium text-foreground",
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <Separator />
        <div className="flex items-center gap-3 px-4 py-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {currentUser ? initials(currentUser.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {currentUser?.name ?? "—"}
            </p>
            {currentUser && (
              <Badge variant="secondary" className="mt-0.5">
                {ROLE_LABELS[currentUser.role]}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Sign out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <div className="ml-60 flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
