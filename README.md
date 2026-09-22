# Fretes Control

Sistema full-stack de controle de fretes, veículos, motoristas, clientes e rastreamento.

## Stack
- Frontend: React + TypeScript + Vite + Leaflet
- Backend: Node.js + Express + TypeScript
- Banco: PostgreSQL + Prisma
- Autenticação: JWT + bcrypt
- Tempo real: Socket.IO
- Infra: Docker Compose

## Requisitos
- Node.js 20+
- Docker Desktop

## 1. Subir PostgreSQL
```bash
docker compose up -d postgres
```

## 2. Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Backend: http://localhost:4000
Swagger-like health endpoint: http://localhost:4000/api/health

Usuário inicial:
- e-mail: admin@fretes.local
- senha: admin123

## 3. Frontend
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Rastreamento
O endpoint:
POST /api/locations
recebe:
```json
{
  "vehicleId": "ID_DO_VEICULO",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "speed": 52
}
```

A posição é gravada no PostgreSQL e enviada pelo Socket.IO para o mapa em tempo real.

> Para GPS real, um rastreador/telemetria deve enviar os dados para esse endpoint ou para um adaptador da API do fornecedor.
