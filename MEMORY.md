# ReviewCanvas

El proyecto parte del kit visual suministrado. La aplicación usa React, TypeScript, Vite, Fabric.js, QR Code Styling, ZXing, IndexedDB, Fastify y PostgreSQL con Prisma.

El documento editable usa un esquema de capas versionado y se reconstruye en Fabric. Los QR estáticos codifican el destino de Google directamente. Las estadísticas de los QR dinámicos guardan únicamente recuentos por día y categoría de dispositivo.

La portada y el editor ofrecen creación desde cero. Vincular un enlace en un documento sin QR visible inserta el primero automáticamente. La validación, la impresión, los mockups y la exportación comparten el renderizado del documento.

El lanzamiento usa Cloudflare Pages, Render Docker, Neon y Supabase Storage. Los invitados permanecen en IndexedDB. La nube guarda los bytes de imágenes en un bucket privado y las referencias por dueño en PostgreSQL. Las migraciones se ejecutan desde administración antes de desplegar el contenedor.
