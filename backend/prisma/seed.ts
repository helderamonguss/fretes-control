import { PrismaClient, VehicleStatus, FreightStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@fretes.local" },
    update: {},
    create: { name: "Administrador", email: "admin@fretes.local", passwordHash }
  });

  const driver = await prisma.driver.upsert({
    where: { cpf: "00000000000" },
    update: {},
    create: {
      name: "Carlos Oliveira",
      cpf: "00000000000",
      phone: "(11) 99999-0000",
      license: "123456789",
      licenseType: "E"
    }
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { plate: "ABC1D23" },
    update: {},
    create: {
      plate: "ABC1D23",
      brand: "Mercedes-Benz",
      model: "Actros",
      year: 2024,
      type: "Cavalo mecânico",
      capacityKg: 30000,
      mileageKm: 84500,
      status: VehicleStatus.IN_TRANSIT,
      driverId: driver.id
    }
  });

  const client = await prisma.client.create({
    data: {
      name: "Cliente Demonstração",
      document: "00.000.000/0001-00",
      phone: "(11) 3333-3333",
      email: "cliente@example.com",
      address: "São Paulo - SP"
    }
  });

  const freight = await prisma.freight.create({
    data: {
      number: "FR-000001",
      clientId: client.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      origin: "São Paulo - SP",
      destination: "Campinas - SP",
      cargo: "Carga industrial",
      weightKg: 12500,
      freightValue: 5800,
      tollCost: 320,
      fuelCost: 950,
      status: FreightStatus.IN_TRANSIT
    }
  });

  await prisma.location.create({
    data: {
      vehicleId: vehicle.id,
      freightId: freight.id,
      latitude: -23.5200,
      longitude: -46.6000,
      speed: 62
    }
  });

  console.log("Seed concluído.");
}

main().finally(() => prisma.$disconnect());
