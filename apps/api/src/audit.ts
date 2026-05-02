import { prisma } from "./db.js";

export async function audit(input: {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: JSON.stringify(input.metadata ?? {})
    }
  });
}
