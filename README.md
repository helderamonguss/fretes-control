# Fretes Control

Sistema full-stack para gestão de fretes, veículos, motoristas, clientes e rastreamento em tempo real.

## Visão geral

O Fretes Control combina um backend em Node.js + Express + Prisma com um frontend em React + TypeScript + Vite para controlar operações logísticas, rastrear veículos e visualizar movimentações em tempo real.

## Stack

- Frontend: React, TypeScript, Vite, Leaflet
- Backend: Node.js, Express, TypeScript
- Banco: PostgreSQL
- ORM: Prisma
- Autenticação: JWT + bcrypt
- Tempo real: Socket.IO
- Infraestrutura: Docker Compose

## Funcionalidades

- Cadastro e listagem de veículos
- Cadastro e listagem de motoristas
- Cadastro e listagem de clientes
- Gestão de fretes e status de entrega
- Dashboard com indicadores gerais
- Rastreamento de localização por veículo
- Atualização em tempo real via Socket.IO
- Seed inicial com usuário administrador e dados demonstrativos

## Requisitos

- Node.js 20+
- npm
- Docker Desktop

## Estrutura do projeto

```text
fretes-control/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Configuração rápida

### 1) Subir o PostgreSQL

```bash
docker compose up -d postgres
```

### 2) Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

A API fica disponível em:

- http://localhost:4000
- http://localhost:4000/api/health

### 3) Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

A interface fica disponível em:

- http://localhost:5173

## Acesso inicial

Usuário padrão criado pelo seed:

- E-mail: admin@fretes.local
- Senha: admin123

## API de rastreamento

Endpoint para registrar localização do veículo:

```http
POST /api/locations
```

Exemplo de payload:

```json
{
  "vehicleId": "ID_DO_VEICULO",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "speed": 52
}
```

A localização é salva no PostgreSQL e emitida em tempo real pelo Socket.IO para o frontend.

> Para integração com GPS real, um rastreador ou telemetria deve enviar os dados para esse endpoint ou para um adaptador do fornecedor.

## Comandos úteis

### Rodar backend

```bash
cd backend
npm run dev
```

### Rodar frontend

```bash
cd frontend
npm run dev
```

### Reaplicar migrations

```bash
cd backend
npx prisma migrate dev
```

## Observações

- O arquivo `.env` do backend deve conter a string de conexão com o PostgreSQL.
- O projeto usa Docker apenas para o banco de dados.
- O frontend e o backend podem ser executados em terminais separados para facilitar o desenvolvimento.

## Licença

Este projeto foi criado para fins de demonstração e estudo.
