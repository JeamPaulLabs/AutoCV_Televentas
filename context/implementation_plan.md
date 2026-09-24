# Actualización de Metas Septiembre 2026 y Configuración Otrosí

Este plan aborda los tres requerimientos solicitados para la operación de Televentas Seguros Vanti en septiembre de 2026:
1. **Ajuste de meta y observación para Santiago Eli Chavez Carmona**: Reducción de meta a 107 por novedad justificada (5 días de incapacidad por fallecimiento de familiar / luto).
2. **Registro de Breiner Barrera**: Configuración de exclusión en `config/asesores_excluidos.yml` para evitar avisos de asesor sin meta al ser personal nuevo.
3. **Configuración del Otrosí de Comisiones Septiembre 2026**: Integración de las reglas del otrosí formalizado el 21 de septiembre de 2026 (pago de comisión a partir del 80% de cumplimiento individual, sujeto a la meta general del equipo de 2.000 altas positivas).

---

## User Review Required

> [!IMPORTANT]
> **Ajuste de Santiago Eli Chavez Carmona (Categoría OMEGA):**
> - Su meta de Escala 1 pasa de **140** a **107**.
> - Sus metas de sobre-ejecución (Escala 2 y 3) se ajustarán proporcionalmente:
>   - Escala 2: de 168 a **128** (107 × 1.2)
>   - Escala 3: de 196 a **150** (107 × 1.4)
> - Las bases de pago se mantienen según escala ($700.000, $1.008.000, $1.372.000).
> - Se registrará en la columna `observaciones` de la base de datos: `"Meta ajustada a 107 por 5 días de incapacidad (fallecimiento de familiar)"`.

> [!NOTE]
> **Esquema del Otrosí (Septiembre 2026):**
> - **Condición general del equipo:** 2.000 altas positivas consolidadas (Cuota Protegida + Rueda Segura). A la fecha del corte van ~1.246 altas positivas con un forecast proyectado de ~1.983.
> - **Condición individual:** Al alcanzarse las 2.000 altas positivas, se habilita comisión desde el 80% de cumplimiento individual de la meta asignada.
> - Se habilitará la configuración para que el motor de cálculo refleje el estado del cumplimiento general y la proyección comisionable desde el 80%.

---

## Proposed Changes

### Base de Datos PostgreSQL (`DataCenter_Vanti`)

#### [MODIFY] Esquema `como_vamos_televentas.metas`
- Ejecutar migración:
  ```sql
  ALTER TABLE como_vamos_televentas.metas
  ADD COLUMN IF NOT EXISTS observaciones TEXT;
  ```
- Actualizar el registro de Santiago:
  ```sql
  UPDATE como_vamos_televentas.metas
  SET meta_escala_1 = 107,
      meta_escala_2 = 128,
      meta_escala_3 = 150,
      observaciones = 'Meta ajustada a 107 por 5 días de incapacidad (fallecimiento de familiar)'
  WHERE periodo = '2026-09-01'
    AND asesor_norm = 'SANTIAGO ELI CHAVEZ CARMONA';
  ```

---

### Configuración del Repositorio

#### [MODIFY] [config/asesores_excluidos.yml](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/config/asesores_excluidos.yml)
- Agregar a `BREINER BARRERA RUDAS` con motivo `"Asesor nuevo, sin meta asignada ni ventas"` para que no genere aviso de discrepancia ni afecte la conciliación.

#### [NEW] [config/esquema_comisiones.yml](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/config/esquema_comisiones.yml)
- Crear archivo centralizado para registrar los parámetros y otrosíes por periodo:
  - Periodo `2026-09`:
    - `otrosi_activo`: true
    - `meta_equipo_altas_positivas`: 2000
    - `pct_minimo_comision`: 0.80
    - `documento`: `"Otrosí, esquema de comisión septiembre 2026"`

#### [MODIFY] [sql/ddl_como_vamos_televentas_metas.sql](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/sql/ddl_como_vamos_televentas_metas.sql)
- Agregar el campo `observaciones TEXT` en la sentencia `CREATE TABLE`.
- Incluir la sentencia `INSERT` con los valores oficiales de las metas de Septiembre 2026 (incluyendo el ajuste de Santiago y su observación).

---

### Lógica de Negocio y Backend Python

#### [MODIFY] [src/metas_repo.py](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/src/metas_repo.py)
- En `leer_metas(periodo)`:
  - Incluir `observaciones` en el query SELECT a `como_vamos_televentas.metas`.

#### [MODIFY] [src/calculo.py](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/src/calculo.py)
- Propagar `observaciones` en `calcular_proyeccion()`.
- Incorporar la evaluación del porcentaje mínimo de comisión (80% bajo Otrosí) cuando aplique para el periodo, devolviendo la información comisionable y la observación correspondiente.

#### [MODIFY] [backend/app/routers/como_vamos.py](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/backend/app/routers/como_vamos.py)
- En el endpoint `/dashboard`:
  - Retornar en `resumen_equipo` el estado del Otrosí (meta de 2.000 altas positivas, total actual de altas positivas y porcentaje de avance hacia la condición general).
  - Incluir el campo `observaciones` en la lista de asesores.

#### [MODIFY] [src/reporte_html.py](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/src/reporte_html.py)
- Mostrar las observaciones de ajuste en la fila del asesor cuando existan (ej. ícono/badge con tooltip o texto explicativo).

---

### Frontend React

#### [MODIFY] [frontend/src/components/TablaAsesores.jsx](file:///c:/01_Repositorios/01_Automatizacion/05_AutoCV_Televentas/frontend/src/components/TablaAsesores.jsx)
- Mostrar un indicador visual (badge/etiqueta informativa o tooltip) en la columna de asesor cuando tenga una observación registrada (ej. el ajuste por luto de Santiago).

---

## Verification Plan

### Automated / CLI Verification
1. **Verificación SQL y Postgres**:
   - Consultar `como_vamos_televentas.metas` para verificar que la columna `observaciones` existe y que Santiago tiene `meta_escala_1 = 107` y su nota correspondiente.
2. **Verificación de Exclusiones**:
   - Correr `python -c "from src.exclusiones import cargar_excluidos; ..."` para confirmar que Breiner Barrera está excluido y que `asesores_sin_meta()` ya no emite advertencia sobre él.
3. **Ejecución del CLI `main.py`**:
   - Ejecutar `python main.py --periodo 2026-09` y verificar que el reporte HTML se genere sin advertencias y con la meta de 107 para Santiago.
4. **Verificación del Backend**:
   - Probar endpoint del router FastAPI con `periodo=2026-09` para validar la respuesta JSON.
