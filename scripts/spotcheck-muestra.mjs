import { leerXlsxHoja1 } from './lib-importacion-odoo.mjs';

const ruta = 'C:\\Users\\juand\\AppData\\Local\\Temp\\claude\\C--Users-juand\\f8fe8781-28b7-4986-9aac-1f7bba873751\\scratchpad\\facturas.xlsx';
const { encabezados, filas } = leerXlsxHoja1(ruta);

const idx = (nombre) => encabezados.indexOf(nombre);
const iNumero = idx('Número');
const iSocio = idx('Nombre del socio a mostrar en la factura.');
const iVenc = idx('Fecha de vencimiento');
const iTotal = idx('Total');
const iAdeudado = idx('Importe adeudado');
const iEstadoPago = idx('Estado de pago');

console.log('Encabezados:', encabezados);
console.log('Total filas:', filas.length);

// filtrar filas reales: numero no vacio y != "/"
const filasReales = [];
filas.forEach((f, origIdx) => {
  const num = f[iNumero];
  if (num && String(num).trim() !== '' && String(num).trim() !== '/') {
    filasReales.push({ origIdx, f });
  }
});

console.log('Filas reales (numero valido):', filasReales.length);

// tomar muestra espaciada cada ~200 en filasReales pero idealmente espaciada a lo largo del archivo completo
// Usamos espaciado sobre filasReales para asegurar numero valido
const paso = Math.floor(filasReales.length / 18); // ~18 muestras
const muestra = [];
for (let i = 0; i < filasReales.length; i += paso) {
  muestra.push(filasReales[i]);
  if (muestra.length >= 18) break;
}

console.log('\n=== MUESTRA ===');
const salida = [];
for (const { origIdx, f } of muestra) {
  const row = {
    filaExcel: origIdx + 2, // +1 por header, +1 por index base1
    numero_factura: String(f[iNumero]).trim(),
    socio: f[iSocio],
    total: f[iTotal],
    fecha_vencimiento: f[iVenc],
    importe_adeudado: f[iAdeudado],
    estado_pago: f[iEstadoPago],
  };
  salida.push(row);
  console.log(JSON.stringify(row));
}

// guardar a json para siguiente paso
import { writeFileSync } from 'fs';
writeFileSync('C:\\Users\\juand\\AppData\\Local\\Temp\\claude\\C--Users-juand\\f8fe8781-28b7-4986-9aac-1f7bba873751\\scratchpad\\muestra_excel.json', JSON.stringify(salida, null, 2));
console.log('\nGuardado en muestra_excel.json');
