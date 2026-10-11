import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFeatureFlags, getRuntimeFlags, patchFeatureFlag } from "@/lib/api";
import { errorMessage, fmtDateTime, fmtRelative, humanize } from "@/lib/format";
import type { Environment, FeatureFlag, FlagPatch } from "@/types";

const ENVS: Environment[] = ["production", "staging", "dev"];

function RolloutControl({
  flag,
  editable,
  onCommit,
}: {
  flag: FeatureFlag;
  editable: boolean;
  onCommit: (value: number) => void;
}) {
  const [value, setValue] = useState(flag.rollout_percent);
  useEffect(() => setValue(flag.rollout_percent), [flag.rollout_percent]);
  return (
    <div className="flex w-48 items-center gap-3">
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={5}
        disabled={!editable}
        onValueChange={([v]) => setValue(v)}
        onValueCommit={([v]) => v !== flag.rollout_percent && onCommit(v)}
        aria-label={`${flag.key} rollout percent`}
      />
      <span className="w-10 text-right text-sm tabular-nums">{value}%</span>
    </div>
  );
}

export default function FeatureFlags() {
  const { can } = useAuth();
  const editable = can("flag:edit");
  const qc = useQueryClient();
  const [env, setEnv] = useState<"all" | Environment>("all");

  const flags = useQuery({
    queryKey: ["flags", env],
    queryFn: () => getFeatureFlags(env === "all" ? undefined : env),
  });
  const runtimeEnv: Environment = env === "all" ? "production" : env;
  const runtime = useQuery({
    queryKey: ["runtime-flags", runtimeEnv],
    queryFn: () => getRuntimeFlags(runtimeEnv),
  });

  const patch = useMutation({
    mutationFn: ({ flag, body }: { flag: FeatureFlag; body: FlagPatch }) =>
      patchFeatureFlag(flag.id, body),
    onSuccess: (row, { body }) => {
      qc.setQueriesData<FeatureFlag[]>({ queryKey: ["flags"] }, (old) =>
        old?.map((f) => (f.id === row.id ? row : f)),
      );
      qc.invalidateQueries({ queryKey: ["runtime-flags"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      toast.success(
        body.enabled !== undefined
          ? `${row.key} ${row.enabled ? "enabled" : "disabled"} in ${row.environment}`
          : `${row.key} rollout set to ${row.rollout_percent}% in ${row.environment}`,
      );
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      qc.invalidateQueries({ queryKey: ["flags"] });
    },
  });

  const enabledCount = flags.data?.filter((f) => f.enabled).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        description="Toggle flags and set rollout percentages per environment. Changes are returned by the runtime API immediately. Rollout % is stored configuration only; this demo has no user-targeting or flag-evaluation engine."
      />

      {!editable && (
        <Alert className="mb-4">
          <Info />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            Only Engineers and Managers can change feature flags.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Tabs value={env} onValueChange={(v) => setEnv(v as "all" | Environment)}>
          <TabsList>
            <TabsTrigger value="all">All environments</TabsTrigger>
            {ENVS.map((e) => (
              <TabsTrigger key={e} value={e}>
                {humanize(e)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-sm text-muted-foreground">
          {flags.data ? `${enabledCount} of ${flags.data.length} enabled` : ""}
        </span>
      </div>

      <Card className="mb-6 gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Flag</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Rollout</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="pr-4 text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="px-4">
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {flags.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No flags in this environment.
                </TableCell>
              </TableRow>
            )}
            {flags.data?.map((f) => (
              <TableRow key={f.id} className={f.enabled ? "" : "text-muted-foreground"}>
                <TableCell className="max-w-md whitespace-normal pl-4">
                  <div className="font-medium text-foreground">{f.name}</div>
                  <div className="font-mono text-xs">{f.key}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{f.description}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge value={f.environment} />
                </TableCell>
                <TableCell>
                  <RolloutControl
                    flag={f}
                    editable={editable}
                    onCommit={(v) =>
                      patch.mutate({ flag: f, body: { rollout_percent: v } })
                    }
                  />
                </TableCell>
                <TableCell>{f.created_by}</TableCell>
                <TableCell title={fmtDateTime(f.updated_at)}>
                  {fmtRelative(f.updated_at)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Switch
                    checked={f.enabled}
                    disabled={!editable || (patch.isPending && patch.variables?.flag.id === f.id)}
                    onCheckedChange={(checked) =>
                      patch.mutate({ flag: f, body: { enabled: checked } })
                    }
                    aria-label={`Toggle ${f.key} in ${f.environment}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime API</CardTitle>
          <CardDescription>
            What services receive when they fetch flags at runtime. Public, no auth
            header required. Returns enabled flags only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">
            GET /api/flags?env={runtimeEnv}
          </code>
          <pre className="max-h-72 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
            {runtime.data
              ? JSON.stringify(
                  runtime.data.map(({ key, rollout_percent }) => ({
                    key,
                    rollout_percent,
                  })),
                  null,
                  2,
                )
              : "Loading…"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
