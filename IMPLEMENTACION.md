# Estado de implementación

## Entregado

- Portada adaptable con modo claro y oscuro. Accesos a plantillas, lienzo en blanco y proyectos.
- Editor Fabric.js con herramientas, propiedades, capas, edición tipográfica y manipulación de objetos. Incluye historial, atajos, reglas, cuadrícula, ajuste, guías y formatos físicos.
- Catálogo de 110 plantillas editables. Incluye 100 composiciones nuevas en diez sectores y diez diseños SVG recuperados del kit. Las seis referencias PNG premium aparecen primero y se reconstruyeron con capas. Café Aurora sigue la captura de interfaz proporcionada.
- Biblioteca de 410 recursos, con 380 vectores originales generados a partir de familias geométricas y 30 decoraciones y fondos del kit.
- QR estáticos personalizados con destino a la sección de reseñas de Google Maps web o al formulario para escribir una reseña. El editor identifica el establecimiento a partir de enlaces de Maps compatibles. Un lienzo sin QR recibe el código al vincular el enlace. ZXing intenta leer los códigos del diseño y los archivos exportados.
- PNG, JPG, SVG, PDF y JSON. Exportación del cartel, el QR o la selección. Descarga por lote en ZIP de proyectos JSON.
- Diez superficies fotográficas con el diseño actual superpuesto y ajustado en perspectiva. Incluye vista de impresión y presentación.
- Proyectos locales en IndexedDB, historial guardado, favoritos, búsqueda, carpetas y marcas. La API usa sesiones y controla el acceso por propietario. PostgreSQL guarda proyectos, marcas y estadísticas agregadas de QR dinámicos.

## Verificado

- Pruebas Vitest y Playwright para los destinos de lectura y escritura, la resolución de enlaces cortos y la exportación.
- Comprobación adicional en el navegador con la versión compilada, dos cuentas temporales y PostgreSQL. Se verificó la recuperación en una sesión distinta y el control de acceso por propietario.
- Demostración de 76 segundos grabada en Chromium con narración de Piper. Utiliza una dirección de ejemplo con el formato directo de reseñas. [Modelo de voz DaveFX](https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/davefx/medium)
- Compilación de TypeScript y Vite.
- Pruebas Vitest con PostgreSQL real. Incluyen registro, autenticación, permisos y actualización concurrente de un proyecto.
- Pruebas Playwright en Chromium de escritorio y emulación móvil. Incluyen generación desde cero, edición de capas, guardado, reapertura, mockup y los cinco formatos de descarga.
- Apertura y renderizado de las 110 plantillas en Chromium.
- Lectura con ZXing del destino directo de reseñas en un PNG exportado, con dimensiones y metadatos de 300 DPI. Prueba de conversión de una URL de Maps con Place ID y recuperación de un proyecto anterior.

## Alcance y limitaciones

- El directorio contenía el kit ya extraído, la captura y seis PNG premium numerados. Se conservaron esos archivos. Los nombres ZIP del documento no estaban disponibles en la carpeta.
- Las composiciones del catálogo se derivan de familias de diseño y adaptaciones por sector. Las galerías muestran lotes paginados y cargan miniaturas WebP bajo demanda.
- Los mockups usan las fotografías conceptuales entregadas. La superposición ajusta el diseño a superficies predefinidas.
- La búsqueda real de Google Places requiere una clave de servidor. La comprobación ZXing verifica el contenido que codifica el QR. La apertura de la sección depende de Google y del dispositivo. El enlace oficial del ejemplo de Google abrió «Todas las reseñas» en la prueba web móvil y mostró la ficha general en la prueba de escritorio. [Enlaces documentados por Google](https://developers.google.com/maps/documentation/places/web-service/maps-links)
- El PDF es rasterizado a la resolución elegida y el SVG conserva la geometría vectorial. Algunas aplicaciones pueden sustituir fuentes ausentes y tratar el texto curvo de forma distinta.
- La sincronización utiliza la versión más reciente por fecha. El historial de recuperación vive en IndexedDB. Las cuentas no incluyen un flujo de recuperación de contraseña por correo.
- Dockerfile y Compose están incluidos. La validación local se hizo con Node y PostgreSQL porque en este equipo no estaba activo el daemon de Docker ni instalado el complemento Compose.
- El modo táctil se probó con un perfil de iPhone en Chromium. La prueba con cámara e impresión física y la evaluación en otros motores de navegador requieren sus dispositivos respectivos.
