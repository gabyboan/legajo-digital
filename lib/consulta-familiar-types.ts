export type FuenteFamiliar = 'cuitonline' | 'nosis' | 'dateas'

export type IntentoFamiliar = {
  fuente: FuenteFamiliar
  estado: 'con_datos' | 'sin_resultados' | 'bloqueado' | 'error'
  detalle: string | null
  resultados: Array<{ nombre: string; numero: string }>
}

export type ConsultaNombreFamiliar = {
  dni: string
  comprobadoEn: string
  requiereRevision: boolean
  intentos: IntentoFamiliar[]
}
