# Despliegue gratuito de ReviewCanvas

ReviewCanvas se divide en un sitio estático, una API sin archivos persistentes y dos servicios de datos. Cloudflare Pages sirve el editor y las plantillas. La API Fastify en Render usa Neon para usuarios, sesiones, diseños y estadísticas. Guarda las imágenes en un bucket privado de Supabase.

## Funcionamiento con Render suspendido

La portada, el editor, las plantillas, el historial local y las exportaciones se ejecutan en el navegador. Como invitado, el editor guarda en IndexedDB y omite las solicitudes de sesión. Acepta un enlace de reseñas directo o un enlace completo de Maps que identifique el negocio. El QR estático codifica ese destino y continúa funcionando cuando se suspenden los servicios de ReviewCanvas.

La versión pública prescinde de las cuentas. Si habilitas las cuentas para una instalación con API, esta interviene al iniciar sesión, sincronizar y usar QR dinámicos. La API también puede ampliar enlaces cortos de Maps. No configures pings para mantener Render despierto.

## 1. PostgreSQL en Neon

1. Crea un proyecto **Free** y una base de datos para ReviewCanvas en una región próxima a Ohio, o ajusta la región de Render según disponibilidad.
2. Copia las dos cadenas de conexión del panel de Neon. La cadena **pooled** con TLS será `DATABASE_URL` en Render. Guarda la cadena **directa** como `DATABASE_URL_DIRECT` en un entorno de administración para aplicar migraciones.
3. Desde una copia limpia del repositorio, con Node 22.12 o posterior, instala dependencias y ejecuta las migraciones.

```sh
npm ci --ignore-scripts
npm run db:generate
# Define DATABASE_URL_DIRECT en la terminal o en un .env ignorado por Git.
npm run db:migrate
```

La migración inicial crea usuarios, sesiones, proyectos, marcas y métricas. La siguiente añade referencias de imágenes privadas. Aplica las migraciones antes del primer despliegue y antes de publicar una versión que agregue más. El contenedor de Render arranca sin ejecutar migraciones ni necesitar la conexión directa. Mantén la URL directa y la de ejecución fuera del repositorio. [Planes de Neon](https://neon.com/docs/introduction/plans)

## 2. Supabase Storage

1. Crea un proyecto **Free**. En Storage crea un bucket **privado** llamado `reviewcanvas-private`.
2. Limita cada archivo a 2 MB y los tipos a `image/png`, `image/jpeg` y `image/webp`. Deja el acceso directo cerrado para `anon` y `authenticated`. En un proyecto compartido, revisa las políticas existentes para que ninguna conceda acceso a ese bucket.
3. Copia el URL HTTPS del proyecto y una clave secreta de servidor de Supabase. Representan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en Render. Se admite la clave secreta actual o una clave de servicio heredada.
4. No expongas la clave en `VITE_*`, Pages Functions ni GitHub. El navegador llama a Fastify. Fastify comprueba la sesión y que la imagen pertenezca al dueño antes de subirla, vincularla o servirla.

Los objetos se guardan bajo `{id-de-usuario}/{sha256}`. La API verifica el dueño en PostgreSQL y devuelve los bytes desde Supabase por streaming. La deduplicación por cuenta admite el mismo archivo en varios proyectos. Las cuentas disponen de hasta 24 MiB y el presupuesto total de imágenes de la aplicación es 700 MiB. El borrado de un diseño conserva los objetos compartidos. Antes de purgar objetos huérfanos, exporta los datos e identifica las referencias en diseños y marcas. [Control de acceso de Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control)

## 3. Backend con Render

1. En un workspace gratuito, conecta el repositorio de GitHub. Crea un **Blueprint** a partir de `render.yaml` o un **Web Service** Docker con plan **Free**.
2. Completa los valores. Usa el origen exacto de Pages, con HTTPS y sin barra final. Puedes elegir de antemano el nombre del proyecto de Pages para conocer ese dominio.

| Variable | Valor |
| --- | --- |
| `APP_ORIGIN` | `https://<tu-proyecto>.pages.dev` |
| `DATABASE_URL` | Cadena pooled de Neon con TLS |
| `API_PROXY_SECRET` | Secreto de al menos 32 caracteres generado por Blueprint. Usa el mismo valor en Pages Functions |
| `SUPABASE_URL` | URL HTTPS del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de servidor |
| `SUPABASE_STORAGE_BUCKET` | `reviewcanvas-private` |
| `GOOGLE_PLACES_API_KEY` | Vacía en el lanzamiento sin servicios facturables |

El Blueprint limita el heap a 256 MiB, usa dos hilos de trabajo y un pool PostgreSQL de tres conexiones. Render asigna `PORT`. El contenedor solo incluye la API y comprueba su proceso en `/healthz`. `/api/health` es una comprobación separada con conexión a Neon y debe ejecutarse desde el origen de Pages. No montes discos.

Render suspende un Web Service gratuito tras 15 minutos sin tráfico. La primera operación de nube puede tardar mientras arranca. Las 750 horas mensuales son por workspace. Consulta también el consumo mensual de ancho de banda y minutos de compilación de ese workspace. Render describe el plan Free como apropiado para pruebas y proyectos ligeros. [Plan Free de Render](https://render.com/docs/free)

## 4. Frontend con Cloudflare Pages

1. En Workers & Pages, crea un proyecto **Pages** con integración Git. Autoriza únicamente este repositorio privado y selecciona `main`.
2. Selecciona Vite o configura estos valores manualmente.

| Campo | Valor |
| --- | --- |
| Directorio raíz | Raíz del repositorio |
| Comando de compilación | `npm run build:frontend` |
| Directorio de salida | `dist` |
| Variable de compilación | `NODE_VERSION=22` |
| Variable de compilación | `NPM_CONFIG_IGNORE_SCRIPTS=true` |
| Variable de compilación | `VITE_ENABLE_PLACES_SEARCH=false` |
| Variable de compilación | `VITE_ENABLE_CLOUD_ACCOUNTS=false` |

3. En las variables del **runtime de producción de Pages Functions** configura `API_ORIGIN=https://<tu-servicio>.onrender.com` y `API_PROXY_SECRET` como secreto. Mantén las dos variables vacías en Preview para que las ramas de vista previa sirvan el editor local sin conectar a producción.
4. Vuelve a desplegar. `_routes.json` limita las funciones a `/api/*` y `/r/*`. Las rutas de editor y proyectos regresan al HTML de la aplicación. Los recursos con hash usan caché inmutable y las respuestas de cuenta y archivos privados usan `no-store`.

El navegador usa el mismo dominio para la app y su API. La función reenvía la cookie HttpOnly, Secure y SameSite=Lax. Fastify valida el origen exacto en las mutaciones, rechaza acceso al API de producción fuera del proxy y conserva las redirecciones directas de los QR dinámicos. Neon usa sesiones con tokens aleatorios almacenados como hash y limita registros e inicios de sesión. [Rutas y límites de Pages](https://developers.cloudflare.com/pages/functions/routing/) · [Cuota de Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/)

## 5. Comprobación después del despliegue

1. Abre `/editor?nuevo` y crea un QR con un enlace directo o completo de Maps. Comprueba la exportación y recarga el proyecto sin iniciar sesión.
2. Abre `https://<tu-proyecto>.pages.dev/api/health` para probar el proxy y Neon. Comprueba `/healthz` en Render para aislar un problema de arranque.
3. Verifica en una ventana privada que «Mis proyectos» y «Mi marca» se abren sin cuenta. Si Render está suspendido, el editor y el QR deben seguir funcionando.
4. Si has habilitado `VITE_ENABLE_CLOUD_ACCOUNTS=true`, registra una cuenta de prueba, importa un PNG en el editor y guarda el proyecto. Confirma que el archivo aparece en el bucket privado y que una segunda cuenta no puede acceder.
5. Para una revisión visual, imprime el cartel de prueba o escanéalo con otra pantalla y comprueba el destino con tu navegador móvil.

### Presupuesto de lanzamiento

| Servicio | Límite gratuito relevante | Optimización aplicada |
| --- | --- | --- |
| Cloudflare Pages | 500 compilaciones al mes según Pages. Las funciones comparten 100 000 solicitudes diarias de Workers Free | CDN para los recursos, funciones solo en la API |
| Render | 750 horas por workspace, suspensión tras 15 minutos | API separada, health check sin DB, sin procesos periódicos |
| Neon | 100 CU-horas, 1 GB de Postgres y 5 GB de transferencia por proyecto | Pool de 3 conexiones, listados de metadatos, JSON sincronizado hasta 750 KB |
| Supabase | 1 GB de archivos y 5 GB de egress sin caché más 5 GB de egress con caché | WebP local cuando conviene, deduplicación, cuota global de 700 MiB y descarga bajo demanda |
| GitHub | Repositorio privado en Free y CI sujeto a la cuota de Actions | CI solo en push a `main` y pull requests, cancelación de ejecuciones superpuestas |

Mantén todos los proveedores en sus planes Free y revisa sus paneles de uso antes de ampliar el acceso. Las cuotas pueden cambiar. Mantén la búsqueda opcional de Places desactivada durante esta fase. [Límites de Pages](https://developers.cloudflare.com/pages/platform/limits/) · [Planes Neon](https://neon.com/docs/introduction/plans) · [Precios de Supabase](https://supabase.com/pricing) · [Egress de Supabase](https://supabase.com/docs/guides/storage/serving/bandwidth)

## 6. Migrar a un VPS

Sirve `dist/` con Caddy o Nginx y configura el fallback de SPA a `index.html`. Ejecuta el mismo contenedor Fastify en una red interna. Enruta `/api/*` y `/r/*` al contenedor. Pon `APP_ORIGIN` en el dominio HTTPS del VPS y conserva `COOKIE_SECURE=true`. Puedes conservar Neon y Supabase o exportar PostgreSQL con `pg_dump` y migrar objetos a una instalación de Supabase Storage compatible preservando rutas y contenido. Aplica `prisma migrate deploy` con la cadena directa antes de iniciar la API.

Si usas un proxy propio, sustituye Pages Functions por el proxy inverso. Quita `API_PROXY_SECRET` para una API aislada en la red privada del VPS, o envía el mismo secreto desde el proxy. Conserva el hostname impreso de los QR dinámicos mediante DNS o una redirección permanente. Los QR estáticos apuntan a Google.

## Desarrollo local

Con PostgreSQL local, copia `.env.example` a `.env`, genera Prisma y aplica migraciones. Ejecuta `npm run dev` y `npm run dev:api`. Para Docker Compose aplica primero las migraciones a la base Compose usando la URL directa en `127.0.0.1:5436` y abre el frontend con Vite. El contenedor de Compose sirve la API en el puerto 4174.
