import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { io } from "socket.io-client";
import { api, setToken } from "./api";

type Vehicle = {
  id: string; plate: string; brand?: string; model?: string; status: string;
  mileageKm: number; driver?: { name: string } | null;
};

type LocationItem = {
  vehicleId: string; plate: string; status: string; driver: string | null;
  location?: { latitude: number; longitude: number; speed?: number | null } | null;
};

const truckIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/741/741407.png",
  iconSize: [34, 34]
});

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@fretes.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      onLogin(data.token);
    } catch {
      setError("E-mail ou senha inválidos.");
    }
  }

  return <div className="login">
    <form onSubmit={submit} className="login-card">
      <div className="brand">FRETES<span>CONTROL</span></div>
      <p>Gestão logística e rastreamento</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" type="password" />
      {error && <div className="error">{error}</div>}
      <button>Entrar</button>
    </form>
  </div>
}

function App() {
  const [token, setTok] = useState(localStorage.getItem("token"));
  const [page, setPage] = useState("dashboard");
  const [dashboard, setDashboard] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [freights, setFreights] = useState<any[]>([]);

  useEffect(() => {
    setToken(token);
    if (!token) return;
    refresh();
    const socket = io("http://localhost:4000");
    socket.on("vehicle:location", refreshLocations);
    return () => { socket.disconnect(); };
  }, [token]);

  async function refresh() {
    const [d, v, f] = await Promise.all([
      api.get("/dashboard"), api.get("/vehicles"), api.get("/freights")
    ]);
    setDashboard(d.data);
    setVehicles(v.data);
    setFreights(f.data);
    refreshLocations();
  }

  async function refreshLocations() {
    try {
      const r = await api.get("/locations/latest");
      setLocations(r.data);
    } catch {}
  }

  function login(t: string) {
    localStorage.setItem("token", t);
    setTok(t);
  }

  function logout() {
    localStorage.removeItem("token");
    setTok(null);
  }

  if (!token) return <Login onLogin={login} />;

  return <div className="app">
    <aside>
      <div className="logo">FRETES<span>CONTROL</span></div>
      <div className="menu">
        {[
          ["dashboard", "▦", "Dashboard"],
          ["mapa", "⌖", "Rastreamento"],
          ["fretes", "⇄", "Fretes"],
          ["veiculos", "▣", "Veículos"],
          ["motoristas", "♙", "Motoristas"],
          ["clientes", "◉", "Clientes"]
        ].map(([id, icon, label]) =>
          <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>
            <span>{icon}</span>{label}
          </button>
        )}
      </div>
      <button className="logout" onClick={logout}>Sair</button>
    </aside>

    <main>
      <header>
        <div>
          <h1>{page === "dashboard" ? "Dashboard" : page === "mapa" ? "Rastreamento" : page[0].toUpperCase() + page.slice(1)}</h1>
          <small>Controle operacional de transportes</small>
        </div>
        <button className="refresh" onClick={refresh}>↻ Atualizar</button>
      </header>

      {page === "dashboard" && dashboard && <Dashboard dashboard={dashboard} />}
      {page === "mapa" && <Tracking locations={locations} />}
      {page === "veiculos" && <Vehicles vehicles={vehicles} onRefresh={refresh} />}
      {page === "fretes" && <Freights freights={freights} onRefresh={refresh} />}
      {page === "motoristas" && <SimpleList endpoint="/drivers" title="Motoristas" fields={["name","phone","license","licenseType"]} />}
      {page === "clientes" && <SimpleList endpoint="/clients" title="Clientes" fields={["name","document","phone","email"]} />}
    </main>
  </div>
}

function Dashboard({ dashboard }: { dashboard: any }) {
  const t = dashboard.totals;
  const cards = [
    ["Fretes ativos", t.activeFreights, "Em operação"],
    ["Veículos", t.vehicles, `${t.vehiclesInTransit} em trânsito`],
    ["Motoristas", t.drivers, "Cadastrados"],
    ["Clientes", t.clients, "Cadastrados"],
    ["Faturamento", money(t.revenue), "Valor dos fretes"],
    ["Custos", money(t.costs), "Combustível + pedágios"],
    ["Margem", money(t.margin), "Faturamento - custos"]
  ];
  return <div>
    <div className="cards">{cards.map(c => <div className="card" key={c[0]}>
      <small>{c[0]}</small><strong>{c[1]}</strong><span>{c[2]}</span>
    </div>)}</div>
    <div className="panel">
      <h2>Resumo operacional</h2>
      <p>O sistema está conectado ao PostgreSQL e ao serviço realtime de localização.</p>
      <div className="status-ok">● API operacional</div>
    </div>
  </div>
}

function Tracking({ locations }: { locations: LocationItem[] }) {
  const valid = locations.filter(x => x.location);
  const center: [number, number] = valid[0]?.location
    ? [valid[0].location.latitude, valid[0].location.longitude]
    : [-23.5505, -46.6333];

  return <div className="map-layout">
    <div className="panel map-panel">
      <MapContainer center={center} zoom={9} style={{ height: "650px", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {valid.map(v => <Marker key={v.vehicleId}
          position={[v.location!.latitude, v.location!.longitude]} icon={truckIcon}>
          <Popup>
            <b>{v.plate}</b><br />
            Motorista: {v.driver || "Não informado"}<br />
            Velocidade: {v.location!.speed ?? 0} km/h
          </Popup>
        </Marker>)}
      </MapContainer>
    </div>
    <div className="panel vehicle-list">
      <h2>Veículos localizados</h2>
      {locations.map(v => <div className="vehicle-row" key={v.vehicleId}>
        <div><b>{v.plate}</b><span>{v.driver || "Sem motorista"}</span></div>
        <strong className={v.status === "IN_TRANSIT" ? "green" : ""}>{v.status}</strong>
      </div>)}
    </div>
  </div>
}

function Vehicles({ vehicles, onRefresh }: { vehicles: Vehicle[], onRefresh: () => void }) {
  const [form, setForm] = useState({ plate: "", brand: "", model: "", year: "", capacityKg: "" });
  async function add() {
    if (!form.plate) return;
    await api.post("/vehicles", {
      ...form, year: form.year ? Number(form.year) : undefined,
      capacityKg: form.capacityKg ? Number(form.capacityKg) : undefined
    });
    setForm({ plate:"",brand:"",model:"",year:"",capacityKg:"" });
    onRefresh();
  }
  return <div className="panel">
    <h2>Cadastro de veículos</h2>
    <div className="form-grid">
      {Object.keys(form).map(k => <input key={k} placeholder={k} value={(form as any)[k]}
        onChange={e => setForm({...form, [k]: e.target.value})} />)}
      <button onClick={add}>Cadastrar</button>
    </div>
    <Table headers={["Placa","Marca","Modelo","Ano","Status","KM","Motorista"]}>
      {vehicles.map(v => <tr key={v.id}><td>{v.plate}</td><td>{v.brand}</td><td>{v.model}</td><td>{v.year}</td><td>{v.status}</td><td>{v.mileageKm}</td><td>{v.driver?.name || "-"}</td></tr>)}
    </Table>
  </div>
}

function Freights({ freights, onRefresh }: { freights: any[], onRefresh: () => void }) {
  async function change(id: string, status: string) {
    await api.patch(`/freights/${id}/status`, { status });
    onRefresh();
  }
  return <div className="panel">
    <h2>Fretes</h2>
    <Table headers={["Número","Cliente","Origem","Destino","Veículo","Valor","Status","Ação"]}>
      {freights.map(f => <tr key={f.id}>
        <td>{f.number}</td><td>{f.client?.name}</td><td>{f.origin}</td><td>{f.destination}</td>
        <td>{f.vehicle?.plate || "-"}</td><td>{money(f.freightValue)}</td><td><span className="badge">{f.status}</span></td>
        <td>{f.status !== "DELIVERED" && <button className="mini" onClick={() => change(f.id, "DELIVERED")}>Entregar</button>}</td>
      </tr>)}
    </Table>
  </div>
}

function SimpleList({ endpoint, title, fields }: { endpoint: string, title: string, fields: string[] }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get(endpoint).then(r => setItems(r.data)); }, [endpoint]);
  return <div className="panel"><h2>{title}</h2><Table headers={fields}>{items.map(i =>
    <tr key={i.id}>{fields.map(f => <td key={f}>{i[f] ?? "-"}</td>)}</tr>
  )}</Table></div>
}

function Table({ headers, children }: { headers: string[], children: React.ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export default App;
