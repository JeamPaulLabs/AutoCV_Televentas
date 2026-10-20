# Instructivo: carga diaria de canceladas con revisión

## Qué hace

Carga la revisión (subsanación / re-auditoría) de las ventas canceladas desde
`REPORTE CANCELADAS 2026 CMK VANTI.xlsx` a la tabla
`como_vamos_televentas.canceladas_revision`, para que la pantalla personal del
asesor muestre el motivo de cancelación y la revisión de Kevin.

## Cuándo ejecutarlo

Cada día (o cuando Kevin actualice el Excel), después de que el archivo se haya
sincronizado por OneDrive.

## Pasos (un solo botón)

1. Verifica que el archivo
   `REPORTE CANCELADAS 2026 CMK VANTI.xlsx` esté actualizado en tu carpeta de
   OneDrive (POSVENTA - XUMA - REPORTES DIARIOS - VANTI).
2. Haz doble clic en **`cargar_canceladas.bat`** (raíz del repo).
3. Revisa la consola: debe mostrar las filas leídas, las válidas y las
   escritas/actualizadas. Si hay algún error (archivo no encontrado, hoja no
   encontrada), la consola se queda abierta (`pause`) para que lo leas.
4. Listo: la próxima vez que un asesor abra su pantalla personal, verá la
   revisión de sus canceladas.

## Opciones avanzadas (línea de comandos)

```
cargar_canceladas.bat --periodo 2026-10
cargar_canceladas.bat --archivo "C:\ruta\al\archivo.xlsx"
cargar_canceladas.bat --hoja-canceladas "TMK OCTUBRE26" --hoja-subsanacion "SUB TMK OCTUBRE 26"
```

## Qué se carga (y qué no)

- Se cargan solo campos operativos: asesor, producto, fecha de venta, causal de
  gestión (motivo), estado de subsanación, observación de Kevin, resultado y
  observación de re-auditoría, estado de subsanación (hoja SUB), solicitud,
  re-auditoría, fechas y gestor.
- **No se cargan datos personales del asegurado** (documento, nombre, teléfono).

## Notas

- La carga es **upsert**: si corres el botón varias veces, no se duplican filas;
  se actualizan las existentes (por periodo + número de contrato).
- Si la tabla no existe, el script la crea automáticamente (ejecuta el DDL).
- Los nombres de asesor en el Excel deben coincidir (en mayúsculas/acentos) con
  los de Ilio para que el cruce en la pantalla personal funcione. Si un asesor
  no ve sus canceladas, revisa que el nombre en el Excel coincida.
- La tipificación NO se carga (decisión de negocio).
- Observaciones largas se muestran truncadas en la UI con opción "ver completo".