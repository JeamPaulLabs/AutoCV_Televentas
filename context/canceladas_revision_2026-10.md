# Contexto: cruce de canceladas con revisión (subsanación / re-auditoría)

Fecha de la sesión: 20 de octubre de 2026. Pendiente de implementar (después de
Rueda Seguro en el acumulado).

## Pedido original (palabras del usuario)

1. Hay un Excel `REPORTE CANCELADAS 2026 CMK VANTI.xlsx` (en la carpeta de
   reportes diarios de Xuma/Posventa) con observaciones de por qué una venta
   fue cancelada y la revisión de Kevin para mandar a subsanar.
2. Se quiere **cruzar esa información en la pantalla personal del asesor** (solo
   ahí, no en el tablero de supervisión ni en el reporte HTML por ahora).
3. En ese Excel:
   - **`TMK OCTUBRE26`** es lo que mandan. Trae la **`CAUSAL DE GESTION`**
     (motivo de cancelación), la **`Observación`** que pone Kevin, y el campo
     **`GESTIÓN SUPERVISOR TMK`** donde hay estados de subsanación.
   - La **`Tipificación`** NO se usa.
   - **`SUB TMK OCTUBRE 26`** es donde va la **re-auditoría**: ahí está la
     aprobación de Luis si se manda a re-auditoría y Luis pone "positivo"
     (puede ponerse "re-auditoría positiva"). Si no está en eso, queda en
     estado de re-auditoría hasta que pase por análisis.
   - En el flujo, **auditada web y transaccional ya son venta efectiva**.
4. "Por el momento" la idea es que el cargue sea **directo a la base de datos**
   y exista un **instructivo para hacer actualizaciones diarias con solo ejecutar
   un botón** (script + `.bat`).
5. Las observaciones son **largas** — la UI debe permitirlas leer bien (truncar
   con "ver completo" / expandir en el popup, no cortar a la fuerza).

## Hojas relevantes del Excel

- `TMK <MES><AÑO>` (ej. `TMK OCTUBRE26`): canceladas de televentas. Columnas
  clave: `fechaVenta`, `fechaDigitacion`, `asesor`, `producto`,
  `numeroContrato`, `observacionAuditoria`, `CAUSAL DE GESTION`,
  `GESTIÓN SUPERVISOR TMK`, `Observación`,
  `RESULTADO DE RE AUDITORIA Y SUBSANACION`.
- `SUB TMK <MES> <AÑO>` (ej. `SUB TMK OCTUBRE 26`): re-auditoría/subsanación.
  Columnas clave: las anteriores + `ESTADO DE SUBSANACION`, `Solicitud`,
  `REAUDITORIA Y SUBSANACION`, `OBSERVACIONES`, `FECHA GESTION`, `GESTOR`,
  `TIEMPO SUBS 1/2`.
- Hay hojas generales (`OCT`, `SUB OCT`) y de oportunidades de mejora (`OP …`)
  que **no** son la fuente de este cruce (solo las `TMK`).

## Diseño acordado (pendiente de implementar)

- **Fuente de verdad**: hojas `TMK …` (canceladas) + `SUB TMK …` (re-auditoría).
- **Tabla nueva** en `como_vamos_televentas`: `canceladas_revision`, keyed por
  `(periodo, numero_contrato)`, con campos operativos: `asesor`, `producto`,
  `fecha_venta`, `causal_gestion`, `gestion_supervisor_tmk` (estado de
  subsanación), `observacion` (la de Kevin), `resultado_re_auditoria`,
  `observacion_re_auditoria`, `estado_subsanacion`, `solicitud`, `gestor`,
  `fecha_gestion`. **Sin** `documentoAsegurado`, `nombreAsegurado` ni
  `telefonoAsegurado` (datos personales del asegurado: no se cargan).
- **ETL** `src/cargar_canceladas.py` + `.bat` + instructivo en `docs/`:
  selecciona la hoja del mes (por argumento o mes en curso), normaliza la llave
  `numeroContrato` (texto, sin `.0` ni espacios), valida conteos
  (leídas / descartadas / escritas) y hace upsert por `(periodo, numero_contrato)`.
- **Cruce**: solo en la pantalla personal del asesor. En el popup del día a día
  (detalle por contrato), si el contrato está en `canceladas_revision`, mostrar
  un bloque "Cancelada — motivo / revisión Kevin / estado subsanación /
  re-auditoría". Observaciones largas: truncar con "ver completo".
- **Estados a tener en cuenta**: subsanación y re-auditoría son estados previos;
  `auditada web` y `alta transaccional` ya son venta efectiva (no se deben
  marcar como canceladas en ese punto).

## Seguridad de datos (ver skill `datos-clientes-seguridad`)

Los datos del asegurado (documento, nombre, teléfono) no deben entrar a la BD ni
al reporte. Solo los campos operativos descritos arriba.

## Preguntas abiertas para cuando se implemente

- ¿Kevin es el gestor que llena la hoja `SUB TMK` (campo `GESTOR` / `Observación`)?
- Confirmar el mapeo exacto de columnas entre `TMK` y `SUB TMK` (algunas difieren
  en nombres: `Observación` vs `OBSERVACIONES`).
- ¿Debe mostrarse el estado de subsanación también en la tarjeta de resumen del
  asesor o solo en el popup por contrato? (Recomendación: solo en el popup, para
  no saturar la vista.)
- Confirmar si el `periodo` de la tabla se deriva del nombre de la hoja o del
  `fechaVenta` (recomendación: nombre de la hoja, consistente con el resto del
  tablero).
