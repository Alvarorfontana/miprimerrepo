# Observatorio Metalúrgico · UOM

Mapa nacional de la industria metalúrgica argentina: plantas, empleo, producción, despidos y suspensiones, con informes por seccional, provincia, región y país, cruzados con las fuentes oficiales (INDEC, CEP XXI, ADIMRA, Cámara Argentina del Acero).

Sitio estático (HTML, CSS y JavaScript sin compilación) más dos scripts que actualizan los datos públicos de forma automática.

## Publicar en Vercel

1. En vercel.com → **Add New → Project** → importá este repositorio.
2. Framework: **Other**. Build command: vacío. Output directory: vacío (la raíz).
3. **Deploy**. Listo.

## Datos

| Archivo | Qué contiene | Cómo se actualiza |
|---|---|---|
| `data/plantas.json` | Plantas UOM con ubicación, rama y seccional | Formulario del portal o edición manual |
| `data/eventos.json` | Despidos, suspensiones, cierres, retiros, con fecha y fuente | Formulario del portal |
| `data/reportes.json` | Reporte mensual por planta: dotación, capacidad, producción, horas, suspendidos | Formulario del portal |
| `data/indicadores.json` | Series ADIMRA, INDEC y Cámara del Acero cargadas con su fuente | Formulario del portal |
| `data/indicadores-auto.json` | Series del INDEC desde la API de Series de Tiempo | Automático (GitHub Actions) |
| `data/establecimientos.json` | Establecimientos metalúrgicos georreferenciados del CEP XXI | Automático (GitHub Actions) |
| `data/fuentes/` | Excel y CSV oficiales sin modificar (OEDE, conflictividad, EIL, SIPA) | Automático (GitHub Actions) |
| `data/empresas.json` | Datos de empresa (despachos, producción, inversión) con fuente | Manual, desde informes de las compañías |
| `data/fuentes.json` | Catálogo de fuentes y variables del modelo de datos | Manual |

El modelo de datos completo está en [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md).

## Actualización automática

`.github/workflows/actualizar-datos.yml` corre los días 5 y 20 de cada mes (también a mano desde **Actions → Actualizar datos públicos → Run workflow**). Descarga las series del INDEC y el padrón de establecimientos del CEP XXI, filtra las ramas metalúrgicas y guarda los resultados en `data/`. Vercel vuelve a publicar solo.

Para fijar una serie del INDEC después de la primera corrida, copiá el `idSerie` que aparece en `data/indicadores-auto.json` al campo `id` de `scripts/series.json`.

## Carga compartida de datos (opcional, gratuita)

Sin configuración, el portal funciona en modo lectura y lo que se carga queda como borrador en el navegador. Para que todas las seccionales carguen en una misma base:

1. Creá un proyecto gratuito en [supabase.com](https://supabase.com).
2. En **SQL Editor** ejecutá `docs/supabase.sql`.
3. Copiá la URL del proyecto y la clave pública `anon` en `js/config.js`.
4. Creá los usuarios de cada seccional en **Authentication → Users**.

## Probar en la computadora

```
npx serve .
```
y abrir http://localhost:3000.

## Cuidado de los datos

Se registran cantidades, nunca nombres de trabajadores. Cada dato lleva fecha y fuente. Las ubicaciones iniciales son aproximadas por localidad y las seccionales asignadas deben confirmarse con la UOM.
