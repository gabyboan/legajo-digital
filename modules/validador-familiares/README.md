# Scraper de consulta de familiares

Copia de código del validador local incorporada el 10/09/2026.
El punto de entrada actualizado es `scraper.py`; incluye `fuentes.py`,
`comparador.py` y `domicilios.py`. Los ejemplos de uso de `scraper.py` se
anonimizaron para la publicación; el comportamiento del scraper se conserva.
No se incluyen resultados, diagnósticos ni domicilios de personas.

La validación documentada en el proyecto de origen el 09/09/2026 obtuvo un
resultado en Nosis y Dateas para el CUIT público de YPF usando Firefox.
La extracción positiva de CuitOnline por DNI no estaba validada en esa nota.

La sección Datos de Familiares ejecuta:

```powershell
python scraper.py <dni> --fuente todas --formato json --navegador firefox --timeout 15
```

Consulta CuitOnline, Nosis y Dateas en paralelo, en segundo plano, para reducir
el tiempo total de espera. Cada fuente conserva su propio estado y resultado.
El límite por operación es 15 segundos; el servidor limita el proceso completo
a 240 segundos. La salida JSON conserva estados por fuente y candidatos.
El adaptador de Legajo Digital sólo entrega los nombres e identificadores que
corresponden al DNI; no guarda ni valida al familiar.

Instalación:

```powershell
python -m pip install -r modules/validador-familiares/requirements.txt
python -m playwright install firefox
```

`DNI_FAMILIARES_CWD` permite usar otra copia compatible. Por defecto se usa
esta carpeta. `DNI_VALIDATOR_PYTHON` selecciona Python. Las variables
`DNI_VALIDATOR_CWD` y `DNI_VALIDATOR_SCRIPT` pertenecen al flujo anterior
de validación de DNI, que conserva su integración.

SHA-256 originales de los archivos incorporados (anteriores a la anonimización):

| Archivo | SHA-256 |
| --- | --- |
| scraper.py | 1911A96A1F6E2460307D6C3669347C3D20428A32338445702EC6BE3D28646669 |
| fuentes.py | 5FC568B0DA97467E244A6631BF73AC91ED5663535A8A819F7C80B3C0E026B26E |
| comparador.py | 3BFF627862BD4081516B873879551714B54D9B5CFA55E41277589CC69F403092 |
| domicilios.py | 75836C1E3183BCE23724B4E457E84DB76BBE5D38FEFB4F2492825036977441EB |
