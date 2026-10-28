# Modelo de datos del Observatorio Metalúrgico

El observatorio funciona como un modelo de datos: cinco entidades conectadas, alimentadas por fuentes propias (seccionales y delegados de la UOM) y públicas (INDEC, CEP XXI, ADIMRA, Cámara Argentina del Acero, SIPA).

## Entidades

### Planta
Una fábrica representada por la UOM.

| Campo | Tipo | Descripción |
|---|---|---|
| id | texto | Identificador único (nombre + localidad) |
| nombre, empresa | texto | Nombre de la planta y razón social |
| rama | texto | Siderurgia, tubos, autopartes, maquinaria agrícola, línea blanca, electrónica, etc. |
| provincia, partido, localidad | texto | Ubicación administrativa |
| seccional | texto | Seccional UOM que la representa |
| lat, lon | número | Coordenadas |
| convenio | texto | Por defecto CCT 260/75 |
| ubicacion | texto | `aproximada` (por localidad) o `marcada` (punto exacto) |

### Reporte mensual
La situación de una planta en un mes. Lo carga la seccional.

| Campo | Tipo | Descripción |
|---|---|---|
| plantaId, periodo | texto | Planta y mes (AAAA-MM) |
| dotacion | entero | Trabajadores totales |
| produccion, unidad | número, texto | Producción del mes |
| capacidad | número | Capacidad instalada usada (%) |
| horas | entero | Horas trabajadas en el mes |
| suspendidos | entero | Trabajadores suspendidos |
| contratados | entero | Contratados y eventuales |
| nota | texto | Observaciones |

### Hecho
Algo que pasó en una planta, con fecha y fuente.

| Campo | Tipo | Descripción |
|---|---|---|
| plantaId, fecha | texto | Planta y fecha |
| tipo | texto | despidos · suspensiones · cierre · retiros · reincorporación · conflicto |
| cantidad | entero | Trabajadores afectados |
| fuente, url | texto | De dónde sale el dato |

### Establecimiento CEP XXI
Padrón oficial georreferenciado, sin nombre de empresa. Se descarga automáticamente.

| Campo | Descripción |
|---|---|
| lat, lon | Ubicación |
| clae6 | Actividad a 6 dígitos (se filtran 24, 25, 26, 27, 28, 293 y 30) |
| empleo | Tramo de empleo |
| provincia, departamento | Ubicación administrativa |

### Indicador
Serie nacional mensual.

| Campo | Descripción |
|---|---|
| serie, periodo, valor, unidad | La serie y su valor en el mes |
| fuente, url | Origen del dato |

## Cruces

- **Planta ↔ Establecimiento CEP XXI**: por ubicación y rama. Muestra qué establecimientos metalúrgicos de una zona todavía no están relevados por la UOM.
- **Planta ↔ Indicador**: el indicador da contexto. La capacidad de una planta se compara con la de su bloque industrial (INDEC) y con el promedio del sector (ADIMRA).
- **Reporte ↔ Hecho**: una suspensión registrada en el reporte mensual anticipa un posible hecho de despido; el sistema marca la planta como alerta.

## Estado de cada planta en el mapa

1. **Cierre**: tiene un hecho de cierre sin reincorporación posterior.
2. **Despidos**: hecho de despidos en los últimos 6 meses.
3. **Suspensiones**: hecho de suspensiones en los últimos 6 meses, o suspendidos en un reporte de los últimos 3 meses.
4. **Sin conflicto**: reporte en los últimos 3 meses sin lo anterior.
5. **Sin reporte reciente**: el resto.

## Fuentes

| Fuente | Conexión | Frecuencia |
|---|---|---|
| Seccionales y delegados UOM | Formulario del portal | Mensual y por hecho |
| CEP XXI, establecimientos productivos | Automática (GitHub Actions) | Según publicación |
| INDEC, API de Series de Tiempo | Automática (GitHub Actions) | Mensual |
| ADIMRA, informe de actividad | Carga mensual | Mensual |
| Cámara Argentina del Acero | Carga mensual | Mensual |
| SIPA, empleo registrado (CEP XXI) | Próxima etapa | Mensual |
| INDEC, comercio exterior | Próxima etapa | Mensual |
| OpenStreetMap | Próxima etapa | A demanda |
