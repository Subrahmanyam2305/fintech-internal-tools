import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/auth/permissions";

export default function Login() {
  const { users, login } = useAuth();
  const [selected, setSelected] = useState<string>("");
  const navigate = useNavigate();

  const user = users.find((u) => String(u.id) === selected);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">OpsDash</CardTitle>
          </div>
          <CardDescription>Internal tools — mock sign-in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name} — {ROLE_LABELS[u.role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="min-h-10 text-sm text-muted-foreground">
            {user ? ROLE_DESCRIPTIONS[user.role] : "Select a user to sign in."}
          </p>
          <Button
            className="w-full"
            disabled={!user}
            onClick={() => {
              if (!user) return;
              login(user.id);
              navigate("/kyc");
            }}
          >
            Sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
