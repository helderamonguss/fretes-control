import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient, FreightStatus, VehicleStatus } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" }
});

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const SECRET = process.env.JWT_SECRET || "development-secret";

type AuthRequest = express.Request & { userId?: string };

function auth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Token não informado" });
  try {
    const payload = jwt.verify(token, SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

app.get("/api/health", (_, res) => res.json({ ok: true, service: "fretes-control-api" }));

app.post("/api/auth/login", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "E-mail ou senha inválidos" });
  }

  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "8h" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/dashboard", auth, async (_, res) => {
  const [vehicles, drivers, freights, clients] = await Promise.all([
    prisma.vehicle.findMany(),
    prisma.driver.findMany(),
    prisma.freight.findMany(),
    prisma.client.count()
  ]);

  const revenue = freights.reduce((s, f) => s + f.freightValue, 0);
  const costs = freights.reduce((s, f) => s + f.tollCost + f.fuelCost + f.otherCost, 0);

  res.json({
    totals: {
      vehicles: vehicles.length,
      vehiclesInTransit: vehicles.filter(v => v.status === VehicleStatus.IN_TRANSIT).length,
      drivers: drivers.length,
      freights: freights.length,
      activeFreights: freights.filter(f => [FreightStatus.PICKUP, FreightStatus.IN_TRANSIT].includes(f.status)).length,
      clients,
      revenue,
      costs,
      margin: revenue - costs
    }
  });
});

app.get("/api/vehicles", auth, async (_, res) => {
  res.json(await prisma.vehicle.findMany({ include: { driver: true }, orderBy: { plate: "asc" } }));
});

app.post("/api/vehicles", auth, async (req, res) => {
  const data = z.object({
    plate: z.string().min(3),
    brand: z.string().optional(),
    model: z.string().optional(),
    year: z.number().int().optional(),
    type: z.string().optional(),
    capacityKg: z.number().optional(),
    mileageKm: z.number().optional()
  }).parse(req.body);
  const vehicle = await prisma.vehicle.create({ data });
  res.status(201).json(vehicle);
});

app.patch("/api/vehicles/:id", auth, async (req, res) => {
  const data = z.object({
    status: z.nativeEnum(VehicleStatus).optional(),
    mileageKm: z.number().optional(),
    driverId: z.string().nullable().optional()
  }).parse(req.body);
  res.json(await prisma.vehicle.update({ where: { id: req.params.id }, data }));
});

app.get("/api/drivers", auth, async (_, res) => {
  res.json(await prisma.driver.findMany({ include: { vehicles: true }, orderBy: { name: "asc" } }));
});

app.post("/api/drivers", auth, async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    cpf: z.string().optional(),
    phone: z.string().optional(),
    license: z.string().optional(),
    licenseType: z.string().optional()
  }).parse(req.body);
  res.status(201).json(await prisma.driver.create({ data }));
});

app.get("/api/clients", auth, async (_, res) => {
  res.json(await prisma.client.findMany({ orderBy: { name: "asc" } }));
});

app.post("/api/clients", auth, async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    document: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional()
  }).parse(req.body);
  res.status(201).json(await prisma.client.create({ data }));
});

app.get("/api/freights", auth, async (_, res) => {
  res.json(await prisma.freight.findMany({
    include: { client: true, vehicle: true, driver: true },
    orderBy: { createdAt: "desc" }
  }));
});

app.post("/api/freights", auth, async (req, res) => {
  const data = z.object({
    number: z.string().min(2),
    clientId: z.string(),
    vehicleId: z.string().optional(),
    driverId: z.string().optional(),
    origin: z.string().min(2),
    destination: z.string().min(2),
    cargo: z.string().optional(),
    weightKg: z.number().optional(),
    freightValue: z.number().default(0),
    tollCost: z.number().default(0),
    fuelCost: z.number().default(0),
    otherCost: z.number().default(0),
    estimatedAt: z.string().datetime().optional()
  }).parse(req.body);

  const freight = await prisma.freight.create({
    data: {
      ...data,
      estimatedAt: data.estimatedAt ? new Date(data.estimatedAt) : undefined
    },
    include: { client: true, vehicle: true, driver: true }
  });

  if (data.vehicleId) {
    await prisma.vehicle.update({
      where: { id: data.vehicleId },
      data: { status: VehicleStatus.IN_TRANSIT }
    });
  }

  res.status(201).json(freight);
});

app.patch("/api/freights/:id/status", auth, async (req, res) => {
  const data = z.object({ status: z.nativeEnum(FreightStatus) }).parse(req.body);
  const freight = await prisma.freight.update({
    where: { id: req.params.id },
    data: {
      status: data.status,
      deliveredAt: data.status === FreightStatus.DELIVERED ? new Date() : undefined
    },
    include: { vehicle: true }
  });

  if (freight.vehicleId && data.status === FreightStatus.DELIVERED) {
    await prisma.vehicle.update({
      where: { id: freight.vehicleId },
      data: { status: VehicleStatus.AVAILABLE }
    });
  }

  res.json(freight);
});

app.get("/api/locations/latest", auth, async (_, res) => {
  const vehicles = await prisma.vehicle.findMany({
    include: { driver: true, locations: { orderBy: { recordedAt: "desc" }, take: 1 } }
  });
  res.json(vehicles.map(v => ({
    vehicleId: v.id,
    plate: v.plate,
    status: v.status,
    driver: v.driver?.name || null,
    location: v.locations[0] || null
  })));
});

app.get("/api/locations/:vehicleId/history", auth, async (req, res) => {
  const locations = await prisma.location.findMany({
    where: { vehicleId: req.params.vehicleId },
    orderBy: { recordedAt: "asc" },
    take: 1000
  });
  res.json(locations);
});

app.post("/api/locations", async (req, res) => {
  const data = z.object({
    vehicleId: z.string(),
    freightId: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    speed: z.number().min(0).optional()
  }).parse(req.body);

  const location = await prisma.location.create({ data });
  await prisma.vehicle.update({
    where: { id: data.vehicleId },
    data: { status: VehicleStatus.IN_TRANSIT }
  });

  io.emit("vehicle:location", location);
  res.status(201).json(location);
});

io.on("connection", socket => {
  console.log("Cliente realtime conectado:", socket.id);
  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
});

httpServer.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
