export function cuitCorrespondeAlDni(cuit: string, dni: string) {
  if (!/^\d{11}$/.test(cuit) || !/^\d{7,8}$/.test(dni) || cuit.slice(2, 10) !== dni.padStart(8, '0')) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const resto = 11 - pesos.reduce((suma, peso, i) => suma + Number(cuit[i]) * peso, 0) % 11
  const digito = resto === 11 ? 0 : resto === 10 ? 9 : resto
  return digito === Number(cuit[10])
}
