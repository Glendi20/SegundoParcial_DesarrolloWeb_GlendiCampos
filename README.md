# AutoPuja GT · Subastas de Vehículos en Tiempo Real (Caso Copart)

## 🌐 Sitio publicado

### 👉 **https://subastas-copart-9250.azurewebsites.net**

> Hospedado en **Azure App Service** (Linux, Node 24, plan B1 con *Always On*) + **Azure SQL Database**.

## 🔑 Credenciales de prueba (usuarios pre-creados)

| # | Nombre | Correo | Contraseña |
|---|---|---|---|
| 1 | Ana López | `ana.lopez@subastasgt.com` | `Subasta#2026A` |
| 2 | Carlos Méndez | `carlos.mendez@subastasgt.com` | `Subasta#2026B` |
| 3 | Lucía Ramírez | `lucia.ramirez@subastasgt.com` | `Subasta#2026C` |

**Prueba cruzada sugerida:** abre el sitio en 2 o 3 navegadores distintos (o una ventana normal + una de incógnito), inicia sesión con un usuario diferente en cada uno y entra al mismo vehículo. Al ofertar en uno, los demás ven al instante la nueva oferta, el historial y el temporizador; el que iba ganando pasa de 🏆 *"¡Vas ganando esta subasta!"* a ⚠️ *"Tu oferta ha sido superada…"* sin recargar (F5).

> Cada usuario tiene vehículos propios publicados (no puede pujar por los suyos), así que conviene pujar con un usuario distinto al publicador.
>
> El inventario de ejemplo incluye subastas activas (cierran en 2-4 meses), una **próxima**, una **vendida** (Honda Civic) y una **desierta** (Jeep Wrangler). Para ver un cierre en vivo, publica un vehículo con fecha de cierre a pocos minutos.

---

## Arquitectura (sistema desacoplado)

```
┌──────────────────────┐   fetch (REST/JSON)    ┌───────────────────────────┐    mssql    ┌──────────────────┐
│  Frontend SPA        │ ─────────────────────► │  Web API RESTful          │ ──────────► │  Azure SQL       │
│  React 18 + Vite     │                        │  Node.js + Express        │             │  (SQL Server)    │
│  React Router        │ ◄═════ WebSocket ═════ │  Socket.IO (tiempo real)  │             │                  │
└──────────────────────┘   pujas / estados      └───────────────────────────┘             └──────────────────┘
```

| Capa | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 18 (SPA), React Router, `fetch` asíncrono, `socket.io-client` | `frontend/` |
| Backend | Node.js, Express (Web API RESTful), Socket.IO, JWT, bcrypt | `backend/` |
| Base de datos | SQL Server (Azure SQL Database) | `sql/schema.sql` |
| Hosting | Azure App Service (la API también sirve la SPA compilada) | — |

## Funcionalidades vs. requerimientos

### A. Autenticación y gestión de usuarios
- **Registro** con Nombre, Apellido, Correo, Teléfono y **contraseña segura** (8+ caracteres, mayúscula, minúscula, número y símbolo; validada en cliente y servidor). Contraseñas guardadas con **bcrypt**.
- **Login** con token **JWT**.
- **Bloqueo de anónimos:** sin sesión solo se ve el Home/Inventario y el detalle en modo lectura. Publicar, editar y ofertar exigen sesión (rutas protegidas en el frontend y `401` en la API).

### B. Publicación de vehículos
- Ficha técnica obligatoria: Año, Tipo de artículo, Marca, Modelo, Motor, Transmisión, Combustible, Tren de manejo (AWD/FWD/RWD/4WD) y Número de cilindros.
- Clasificación de daño: 🟢 **Verde** (menor/limpio) · 🟡 **Amarillo** (medio/reparable) · 🔴 **Rojo** (severo/salvamento).
- **Galería de mínimo 5 fotos** (subidas desde el equipo —se comprimen en el navegador— o por URL), con reordenamiento y portada.
- Parámetros: monto base (Q), fecha/hora de inicio y de cierre.
- **Mis publicaciones:** buscador para encontrar y **editar** tus vehículos (si ya tienen pujas se bloquean el monto base y el inicio; el cierre solo puede extenderse). Se pueden eliminar si aún no tienen pujas.

### C. Home e inventario dinámico
- Cards con foto, estado (En vivo / Próxima / Vendido / Desierta), color de daño, oferta actual, número de pujas y cuenta regresiva.
- **Filtros multitarea** combinables: texto libre, marca (varias), modelo, rango de años, combustible, nivel de daño, tren de manejo, tipo, transmisión, motor, cilindros, precio máximo, estado y orden.
- Las cards se actualizan en vivo cuando alguien puja.
- Paleta clara (blanco, azul y ámbar).

### D. Detalle y motor de subastas
- Ficha técnica completa + **carrusel interactivo** (flechas, miniaturas, teclado, deslizamiento táctil y pantalla completa).
- **Reglas de puja validadas en el servidor** (transacción con bloqueo de fila para evitar condiciones de carrera):
  - la primera oferta debe ser **mayor** al monto base (ej. base Q 20,000 → Q 20,000 se rechaza);
  - cada nueva oferta debe ser **mayor** a la actual y superarla por **al menos 10 %**;
  - solo entre la fecha de inicio y la de cierre (hora del servidor) → si ya terminó: *"Oferta cerrada"*;
  - el publicador no puede pujar por su propio vehículo.
- **Privacidad:** la API nunca devuelve quién ofertó; el historial muestra *"Postor anónimo"* con monto y hora.
- **Tiempo real (Socket.IO):** oferta actual, historial, contador de pujas, espectadores y temporizador sincronizado con la hora del servidor, sin F5.
- **Indicadores visuales:** badge verde *"¡Vas ganando esta subasta!"* / badge rojo *"Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!"*, más avisos emergentes aunque estés en otra página.
- **Cierre automático:** al llegar la hora fin, si hubo oferta ≥ base → *Vendido*; si no → **no vendida / desierta**. Se notifica a todos en vivo.

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/registro` | — | Crea cuenta y devuelve token |
| POST | `/api/auth/login` | — | Inicia sesión |
| GET | `/api/auth/me` | ✔ | Usuario actual |
| GET | `/api/catalogos` | — | Catálogos (tipos, combustibles, trenes, daños, marcas, años) |
| GET | `/api/vehiculos` | — | Inventario con filtros (`q, marca, modelo, anioMin, anioMax, combustible, danio, trenManejo, tipoArticulo, transmision, motor, cilindros, precioMax, estado, orden`) |
| GET | `/api/vehiculos/:id` | opcional | Detalle, fotos, historial anónimo y `miEstado` |
| GET | `/api/vehiculos/mios?q=` | ✔ | Buscar mis publicaciones |
| POST | `/api/vehiculos` | ✔ | Publicar vehículo |
| PUT | `/api/vehiculos/:id` | ✔ (dueño) | Editar publicación |
| DELETE | `/api/vehiculos/:id` | ✔ (dueño) | Eliminar (sin pujas) |
| POST | `/api/vehiculos/:id/pujas` | ✔ | Ofertar `{ monto }` |
| GET | `/api/fotos/:id` | — | Imagen subida |
| GET | `/api/health` | — | Estado de API y BD |

**Eventos Socket.IO:** `puja:nueva` (a todos, sin identidad), `puja:estado` (`ganando` / `superado` / `ganado`, solo al usuario afectado), `subasta:cerrada`, `vehiculo:cambio`, `espectadores`.

## Ejecutar en local

```bash
# Backend
cd backend
cp .env.example .env        # datos de tu SQL Server y un JWT_SECRET
npm install
npm run dev                 # http://localhost:3000 (crea tablas y datos de prueba si la BD está vacía)

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxy a la API local)
```

Reiniciar los datos de prueba: `cd backend && npm run seed -- --reset` (o `node src/seed.js --reset`).

## Despliegue (Azure)

Recursos: Azure SQL Database (serverless, oferta gratuita) + Azure App Service Linux (Node 24) con WebSockets habilitados. Variables de entorno de la Web App: `DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, DB_ENCRYPT=true, DB_TRUST_CERT=false, JWT_SECRET, CORS_ORIGINS`.

Desde **Azure Cloud Shell**:

```bash
git clone https://github.com/Glendi20/SegundoParcial_DesarrolloWeb_GlendiCampos.git subastas
cd subastas && bash deploy-azure.sh subastas-copart-9250 rg-reto-api
```

El script compila el frontend, lo copia a `backend/public` y sube el paquete con `az webapp deploy`.

## Estructura

```
backend/src/
  index.js              servidor Express + Socket.IO, sirve la SPA
  db.js / schema.js     conexión y creación de tablas
  seed.js               3 usuarios de prueba + inventario de ejemplo
  auth.js               JWT (middlewares opcional/requerido)
  realtime.js           salas y eventos de tiempo real
  routes/auth.js        registro / login
  routes/vehiculos.js   inventario, detalle, publicar, editar, pujar, fotos
  services/reglas.js    catálogos, validaciones, estado y monto mínimo
  services/pujas.js     motor de pujas transaccional
  services/cierre.js    cierre automático (vendido / desierta)
frontend/src/
  pages/Home.jsx        hero + inventario con filtros multitarea
  pages/Detalle.jsx     carrusel, ficha, panel de puja en vivo
  pages/Publicar.jsx    publicar / editar (fotos, daño, parámetros)
  pages/MisPublicaciones.jsx
  pages/Auth.jsx        login y registro
sql/schema.sql          esquema de referencia
deploy-azure.sh         despliegue desde Cloud Shell
```

---
Fotografías de ejemplo: [Wikimedia Commons](https://commons.wikimedia.org) (licencias libres de sus autores).
