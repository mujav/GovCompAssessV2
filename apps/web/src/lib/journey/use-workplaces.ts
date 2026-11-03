"use client";

import { useMemo } from "react";
import type { StoredUser } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { useAdmin } from "@/lib/admin/store";
import { entityFrameworks, type EntityFramework } from "./frameworks";
import type { Client } from "./portfolio";
import { useJourney } from "./store";
import { workplaceClient, type Workplace, type WorkplaceClient } from "./workplaces";

export interface WorkplaceView {
  workplace: Workplace;
  entity: Client;
  client: WorkplaceClient;
  framework?: EntityFramework;
  owners: StoredUser[];
}

/** Every workplace with its entity, index and owners resolved. Workplaces whose entity is gone are left out. */
export function useWorkplaces(): WorkplaceView[] {
  const { workplaces, clients } = useJourney();
  const { state: admin } = useAdmin();
  const { users } = useAuth();
  return useMemo(
    () =>
      workplaces.flatMap((w) => {
        const entity = clients.find((c) => c.id === w.entityId);
        if (!entity) return [];
        const framework = entityFrameworks({ ...entity, frameworkIds: [w.frameworkId] }, admin.frameworks)[0];
        const name = framework?.name ?? entity.frameworks[0] ?? w.frameworkId;
        return [{ workplace: w, entity, client: workplaceClient(w, entity, name), framework, owners: users.filter((u) => w.ownerIds.includes(u.id)) }];
      }),
    [workplaces, clients, admin.frameworks, users],
  );
}

/** The workplaces the signed-in user works in: all for admins, the ones granted to a viewer, their own for index owners, their entity's for control owners. */
export function useMyWorkplaces(): WorkplaceView[] {
  const all = useWorkplaces();
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return [];
    if (user.role === "owner") return all.filter((v) => v.workplace.ownerIds.includes(user.id));
    if (user.role === "control") return all.filter((v) => !user.entityId || v.workplace.entityId === user.entityId);
    if (user.role === "viewer") return all.filter((v) => (user.workspaceIds ?? []).includes(v.client.id));
    return all;
  }, [all, user]);
}

/** Control owners requirements in an entity can be assigned to. */
export function useControlOwners(entityId: string | undefined) {
  const { users } = useAuth();
  return useMemo(() => users.filter((u) => u.role === "control" && u.active && (!u.entityId || u.entityId === entityId)), [users, entityId]);
}
