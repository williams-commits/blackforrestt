import { z } from "zod";
import { prisma } from "@/server/db";
import { CrmError } from "@/server/guard";
import { appendAudit } from "@/server/audit";
import { appendActivity } from "@/server/activity";
import { notify } from "@/server/notifications";
import { resolveSubject } from "@/server/records/subjects";
import type { ScopedContext } from "@/server/records/leads";

/** Appointments: scheduled interactions tied to a record. */

export const CreateAppointment = z.object({
  title: z.string().trim().min(2).max(200),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  locationOrLink: z.string().trim().max(300).optional().nullable(),
  ownerUserId: z.string().trim().min(5).optional(),
  subjectType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "CUSTOMER"]),
  subjectId: z.string().trim().min(5),
});

export const UpdateAppointment = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional().nullable(),
  locationOrLink: z.string().trim().max(300).optional().nullable(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

export async function createAppointment(ctx: ScopedContext, input: z.infer<typeof CreateAppointment>) {
  const subject = await resolveSubject(ctx, input.subjectType, input.subjectId);
  const ownerUserId = input.ownerUserId ?? ctx.userId;
  if (ownerUserId !== ctx.userId && !ctx.permissions.includes("TASKS_EDIT")) {
    throw new CrmError("Forbidden — TASKS_EDIT permission required to schedule for others", 403);
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        locationOrLink: input.locationOrLink ?? null,
        ownerUserId,
        subjectType: subject.type,
        subjectId: subject.id,
      },
    });
    if (subject.type === "LEAD") {
      await tx.lead.update({ where: { id: subject.id }, data: { lastContactAt: new Date() } });
    }
    await appendActivity(tx, {
      subjectType: subject.type,
      subjectId: subject.id,
      kind: "appointment_scheduled",
      actorUserId: ctx.userId,
      payload: { appointmentId: created.id, title: created.title },
    });
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "APPOINTMENT_CREATED",
      objectType: "Appointment",
      objectId: created.id,
      after: { title: created.title, startAt: created.startAt.toISOString() },
    });
    return created;
  });

  if (ownerUserId !== ctx.userId) {
    await notify({
      recipientUserId: ownerUserId,
      type: "APPOINTMENT_SCHEDULED",
      payload: { appointmentId: appointment.id, title: appointment.title, byName: ctx.name },
    });
  }
  return appointment;
}

export function listAppointmentsBySubject(
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
  subjectId: string,
  take = 10,
) {
  return prisma.appointment.findMany({
    where: { subjectType, subjectId },
    orderBy: { startAt: "asc" },
    take,
  });
}

export function upcomingAppointmentsForUser(userId: string, take = 10) {
  return prisma.appointment.findMany({
    where: { ownerUserId: userId, status: "SCHEDULED", startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take,
  });
}

export async function updateAppointment(
  ctx: ScopedContext,
  id: string,
  input: z.infer<typeof UpdateAppointment>,
) {
  const existing = await prisma.appointment.findFirst({ where: { id, ownerUserId: ctx.userId } });
  // Owners manage their own appointments; managers+ may manage any.
  if (!existing) {
    if (ctx.scope === "ORG" || ctx.permissions.includes("TASKS_EDIT")) {
      const any = await prisma.appointment.findUnique({ where: { id } });
      if (!any) throw new CrmError("Appointment not found.", 404);
    } else {
      throw new CrmError("Appointment not found.", 404);
    }
  }

  return prisma.$transaction(async (tx) => {
    const saved = await tx.appointment.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
        ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
        ...(input.locationOrLink !== undefined ? { locationOrLink: input.locationOrLink } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    if (existing && existing.subjectType && existing.subjectId && input.status && input.status !== existing.status) {
      await appendActivity(tx, {
        subjectType: existing.subjectType as "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY",
        subjectId: existing.subjectId,
        kind:
          input.status === "COMPLETED"
            ? "appointment_completed"
            : input.status === "CANCELLED"
              ? "appointment_cancelled"
              : "appointment_scheduled",
        actorUserId: ctx.userId,
        payload: { appointmentId: id, title: existing.title },
      });
    }
    await appendAudit(tx, {
      actorId: ctx.userId,
      ip: ctx.ip,
      action: "APPOINTMENT_UPDATED",
      objectType: "Appointment",
      objectId: id,
      before: existing ? { status: existing.status } : undefined,
      after: { status: saved.status },
    });
    return saved;
  });
}
