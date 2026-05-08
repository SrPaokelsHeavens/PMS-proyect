import { prisma } from "../db.js";

export async function upsertGuest(input: {
  documentType: string;
  documentNumber: string;
  fullName: string;
  birthDate?: Date;
  district?: string;
  occupation?: string;
  phone?: string;
  email?: string;
}) {
  const existing = await prisma.guest.findFirst({
    where: {
      documentType: input.documentType,
      documentNumber: input.documentNumber
    },
    orderBy: { updatedAt: "desc" }
  });

  const data = {
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    fullName: input.fullName,
    birthDate: input.birthDate,
    district: input.district || "",
    occupation: input.occupation || "",
    phone: input.phone || "",
    email: input.email || ""
  };

  if (!existing) return prisma.guest.create({ data });
  return prisma.guest.update({ where: { id: existing.id }, data });
}

