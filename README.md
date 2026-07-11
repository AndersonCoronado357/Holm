# Holm

App personal de organización: **tareas, proyectos, notas, ideas y hábitos**.
Solo escritorio, sin suscripción. Cada cuenta tiene su propio espacio aislado y
todos los datos viven en tu equipo (MongoDB local). Incluye registro, inicio de
sesión y recuperación por pregunta de seguridad.

Cada vista es su propia isla: **Inicio**, **Tareas**, **Proyectos**, **Notas**, **Ideas** y **Hábitos**.
Tareas, Proyectos, Notas e Ideas son **pizarrones libres** estilo lienzo infinito (pan/zoom,
varias páginas, varios tipos de elemento). Hábitos es un seguimiento diario con rachas.
Inicio es un resumen del día (solo muestra).

## Stack

- **Cliente** — React 19 + TypeScript + Vite 6 + Tailwind CSS 4. Lienzo hecho a mano con DOM/SVG
  (contenedor con `transform` para pan/zoom, elementos como nodos posicionados, capa SVG para flechas).
- **Servidor** — Node + Express + el driver oficial de MongoDB.
- **Datos** — MongoDB local (`127.0.0.1:27017`, base `holm`). Sin servicios en la nube.

## Estructura

```
Holm/
  client/            Frontend (Vite + React + Tailwind)
    src/
      api/           Cliente HTTP y tipos compartidos
      canvas/        Motor del lienzo (viewport, elementos, flechas, toolbar)
      components/    Isla de navegación, picker de color, iconos
      views/         Inicio, Lienzo (Tareas/Proyectos/Notas/Ideas), Hábitos, Ajustes
      state/         Tema (claro / oscuro / sistema)
      lib/           Utilidades (fechas, rachas, color)
  server/            Backend (Express + MongoDB)
    src/
      routes/        pages, elements, habits, habit-logs, settings, summary
      db.ts          Conexión a MongoDB
      index.ts       Arranque del API
```

## Puertos

| Proceso        | Puerto | Notas                                            |
|----------------|--------|--------------------------------------------------|
| Cliente (Vite) | `5191` | Puerto fijo (`strictPort`). Es el que se abre.   |
| Servidor (API) | `5192` | Variable propia `HOLM_API_PORT`.                 |

El cliente proxia `/api` al servidor. Ambos puertos se eligieron para no chocar con otros
proyectos del entorno.

## Desarrollo

Requisitos: Node 18+ y un MongoDB local corriendo en `127.0.0.1:27017`.

```bash
npm install          # instala raíz, cliente y servidor (workspaces)
npm run dev          # arranca servidor (5192) y cliente (5191) a la vez
```

Luego abre `http://localhost:5191`.

### Configuración del servidor

El servidor lee `server/.env` (hay un `server/.env.example` de referencia):

```
HOLM_API_PORT=5192
HOLM_JWT_SECRET=...   # secreto largo y aleatorio para firmar las sesiones
MONGO_HOST=127.0.0.1
MONGO_PORT=27017
MONGO_DB=holm
MONGO_USER=...
MONGO_PASSWORD=...
MONGO_AUTH_SOURCE=admin
```

La autenticación se pasa por opciones del driver (no por la URI), así que la contraseña
puede llevar caracteres especiales sin necesidad de escaparlos.

### Scripts

| Script            | Qué hace                                         |
|-------------------|--------------------------------------------------|
| `npm run dev`     | Cliente + servidor con recarga en caliente       |
| `npm run build`   | Compila el cliente a producción                  |
| `npm run start`   | Arranca solo el servidor (API)                   |
| `npm run typecheck` | Verifica tipos de cliente y servidor           |

## Atajos del lienzo

- **Mover el lienzo:** arrastra el fondo, o usa la rueda / trackpad.
- **Zoom:** `Ctrl` + rueda (o los botones de la esquina inferior derecha).
- **Mover un elemento:** arrástralo. **Redimensionar:** tira de la esquina.
- **Eliminar:** selecciónalo y pulsa `Supr`. **Deseleccionar:** `Esc`.
- Cada elemento lleva su propio color (picker personalizado en su barra).
