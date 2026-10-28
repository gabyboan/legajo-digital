/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
// All names, numbers and accounts in this runner are synthetic.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, overrides = {}, cache = new Map()) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const testModule = { exports: {} }
  cache.set(file, testModule.exports)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in overrides) return overrides[id]
    if (id === 'server-only') return {}
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts', overrides, cache)
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), overrides, cache)
    return require(id)
  }, testModule, testModule.exports)
  return testModule.exports
}

const { validarPersona } = load('lib/personas/formulario.ts')
const { contactoDesdeRegistro, versionContacto } = load('lib/personas/contacto.ts')
const { guardarEdicionPersona, argumentosPersona } = load('lib/personas/persistencia.ts')
const { versionDomicilio } = load('lib/personas/domicilio.ts')
const { DOMICILIO_FIELDS } = load('lib/personas/types.ts')
const original = { telefono: '+54 (11) 5555-0100', numero_contacto: null }
function form(contact = original, changes = {}) {
  const result = new FormData()
  const values = {
    dni: '12345678', apellido: 'Persona', nombre: 'Ficticia',
    carrera_id: '1', situacion_id: '2', ficha_version: '1'.repeat(32),
    telefono: contactoDesdeRegistro(contact).telefono,
    contacto_version: versionContacto(contact), ...changes,
  }
  for (const [key, value] of Object.entries(values)) result.set(key, value ?? '')
  return result
}
function parsed(contact = original, changes = {}) {
  const result = validarPersona(form(contact, changes))
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.datos
}
function client(contact = original, { readError = null, writeError = null } = {}) {
  const reads = [], writes = []
  return {
    reads, writes,
    from(table) {
      reads.push(table)
      const query = { select() { return query }, eq() { return query },
        async maybeSingle() { return { data: contact, error: readError } },
      }
      return query
    },
    async rpc(name, rawArgs) {
      writes.push({ name, rawArgs, args: name === 'rpc_persona_editar_versionada' ? rawArgs.p_datos : rawArgs })
      return { data: null, error: writeError }
    },
  }
}

async function main() {
  const valid = parsed(original, { email: ' persona@example.invalid ', matricula: 'AB123', fecha_nacimiento: '2024-02-29' })
  assert.deepEqual(Object.keys(valid), ['version','identificacion','contacto','laboral','formacion','domicilio','observaciones'])
  assert.equal(valid.contacto.email, 'persona@example.invalid')
  assert.equal(valid.domicilio, null, 'Missing address section must not be translated into empty address fields')
  assert.equal(argumentosPersona(valid, original, null).p_horario_rotativo, null)
  for (const [field, value] of [
    ['dni','1e7'], ['dni','123'], ['apellido','  '], ['nombre',''],
    ['email','sin-arroba'], ['telefono','sin numeros'], ['cuil','123'], ['cuil','01234567890'],
    ['fecha_nacimiento','2026-02-30'], ['fecha_ingreso','2026-13-01'],
    ['legajo','2.5'], ['reloj','9007199254740993'], ['carrera_id','0'],
    ['situacion_id','-1'], ['matricula','ABCDEFGHIJK'],
  ]) {
    const result = validarPersona(form(original, { [field]: value }))
    assert.equal(result.ok, false, field)
    assert.ok(result.state.errors[field], field)
    assert.equal(result.state.values[field], value, 'Validation must retain the submitted value, without truncation')
  }
  const file = form()
  file.set('apellido', new File(['synthetic'], 'example.txt'))
  assert.equal(validarPersona(file).ok, false)
  const repeatedField = form()
  repeatedField.append('telefono', 'otro 123')
  assert.equal(validarPersona(repeatedField).ok, false)
  assert.equal(parsed(original, { dni: '05956728' }).identificacion.dni, 5956728)
  assert.equal(parsed(original, { telefono: '011 5555-0100 int. 3' }).contacto.telefono, '011 5555-0100 int. 3')

  const legacy = { telefono: null, numero_contacto: 1155550100 }
  let db = client(legacy)
  assert.equal((await guardarEdicionPersona(db, parsed(legacy))).ok, true)
  assert.equal(db.writes[0].args.p_telefono, '1155550100')
  assert.equal(db.writes[0].args.p_numero_contacto, null)
  assert.equal(db.writes[0].name, 'rpc_persona_editar_versionada')
  assert.equal(db.writes[0].rawArgs.p_version, '1'.repeat(32))
  for (const version of ['', 'no-es-una-version']) {
    const missing = client()
    assert.equal((await guardarEdicionPersona(missing, parsed(original, { ficha_version: version }))).ok, false)
    assert.equal(missing.writes.length + missing.reads.length, 0)
  }
  const simultaneous = client(original, { writeError: { code: 'P4090', message: 'INTERNAL_DATA' } })
  const stale = await guardarEdicionPersona(simultaneous, parsed())
  assert.equal(stale.ok, false)
  assert.match(stale.message, /Otra edición/)
  assert.equal(JSON.stringify(stale).includes('INTERNAL_DATA'), false)
  const repeated = { telefono: '+54 (11) 5555-0100', numero_contacto: 541155550100 }
  assert.equal(contactoDesdeRegistro(repeated).pendiente, false)
  db = client(repeated)
  await guardarEdicionPersona(db, parsed(repeated))
  assert.equal(db.writes[0].args.p_numero_contacto, null)
  assert.equal(db.writes[0].args.p_telefono, repeated.telefono)

  const conflict = { telefono: '011 5555-0100', numero_contacto: 1155550200 }
  assert.equal(contactoDesdeRegistro(conflict).pendiente, true)
  db = client(conflict)
  await guardarEdicionPersona(db, parsed(conflict, { telefono: '999', nombre: 'Otro nombre ficticio' }))
  assert.equal(db.writes[0].args.p_telefono, conflict.telefono, 'Unreviewed numbers must remain unchanged even if the input is tampered with')
  assert.equal(db.writes[0].args.p_numero_contacto, conflict.numero_contacto)
  assert.equal(db.writes[0].args.p_nombre, 'Otro nombre ficticio')
  db = client(conflict)
  await guardarEdicionPersona(db, parsed(conflict, { telefono: '+54 11 5555-0300', confirmar_revision_contacto: 'on' }))
  assert.equal(db.writes[0].args.p_telefono, '+54 11 5555-0300')
  assert.equal(db.writes[0].args.p_numero_contacto, null)
  db = client(conflict)
  assert.equal((await guardarEdicionPersona(db, parsed(original))).ok, false)
  assert.equal(db.writes.length, 0, 'Stale form must not overwrite changed contacts')
  const invalidOldContact = { telefono: 'No informado', numero_contacto: 1155550200 }
  const contextual = validarPersona(form(invalidOldContact), { validarContacto: false })
  assert.equal(contextual.ok, true)
  db = client(invalidOldContact)
  assert.equal((await guardarEdicionPersona(db, contextual.datos)).ok, true)
  assert.equal(db.writes[0].args.p_telefono, invalidOldContact.telefono)
  db = client(null)
  assert.equal((await guardarEdicionPersona(db, parsed())).ok, false)
  assert.equal(db.writes.length, 0)
  db = client(original, { readError: { message: 'INTERNAL_DATA' } })
  assert.equal((await guardarEdicionPersona(db, parsed())).ok, false)
  assert.equal(db.writes.length, 0)
  db = client(original, { writeError: { code: 'XX000', message: 'INTERNAL_DATA' } })
  assert.equal(JSON.stringify(await guardarEdicionPersona(db, parsed())).includes('INTERNAL_DATA'), false)

  class Redirect extends Error { constructor(url) { super(url); this.url = url } }
  const makeActions = (allowed, database) => load('app/(private)/personas/actions.ts', {
    'next/navigation': { redirect: (url) => { throw new Redirect(url) } },
    'next/cache': { revalidatePath() {} },
    '@/utils/supabase/server': { createClient: async () => database },
    '@/lib/persona-comprobaciones': {},
    './permissions': { canCurrentUserEditLegajo: async () => allowed, canCurrentUserWriteFrancos: async () => false },
  })
  db = client()
  assert.equal((await makeActions(false, db).updatePersonaConEstado({ status: 'idle' }, form())).status, 'error')
  assert.equal(db.reads.length + db.writes.length, 0, 'Denied user must never read or write through the action')
  assert.equal((await makeActions(true, db).updatePersonaConEstado({ status: 'idle' }, form(original, { apellido: '' }))).status, 'error')
  assert.equal(db.reads.length + db.writes.length, 0, 'Invalid input must never reach the database')
  await assert.rejects(makeActions(true, db).updatePersonaConEstado({ status: 'idle' }, form()), (error) => error instanceof Redirect && error.url === '/personas/12345678')
  assert.equal(db.writes.length, 1)
  await testDomicilio()
  db = client()
  await assert.rejects(makeActions(true, db).createPersona(form(original, { asiste_1: 'on', hora_desde_1: '08:00', hora_hasta_1: '12:00' })), (error) => error instanceof Redirect && error.url.includes('permisos'))
  assert.equal(db.writes.length, 0, 'Assistance permission must be checked before creating a person')
  console.log('Ficha: validación por grupos, contactos únicos/duplicados/en revisión, formularios desactualizados, errores y autorización antes de guardar: OK')
}

async function testDomicilio() {
  const anterior = Object.fromEntries(DOMICILIO_FIELDS.map((field) => [field, null]))
  Object.assign(anterior, { calle: 'Calle de prueba', numero: '007', barrio: 'Barrio ficticio', casa: 'Casa de prueba', torre: '02', provincia_georef_id: '01', provincia_nombre: 'Provincia ficticia', localidad_georef_id: '0101', localidad_nombre: 'Localidad ficticia' })
  const actualizado = { ...anterior, numero: 'S/N', piso: '0', referencias: 'Referencia sintética' }
  const data = (values = actualizado, version = versionDomicilio(anterior)) => parsed(original, { domicilio_presente: '1', domicilio_version: version, ...values })

  function addressClient({ initial = anterior, after = actualizado, readError = null, afterError = null } = {}) {
    const db = client()
    const baseFrom = db.from.bind(db)
    const reads = []
    db.from = (table) => {
      if (table !== 'persona_domicilios') return baseFrom(table)
      db.reads.push(table)
      const query = {
        select() { return query },
        eq(column, value) { assert.equal(column, 'persona_dni'); assert.equal(value, 12345678); return query },
        is(column, value) { assert.equal(column, 'vigente_hasta'); assert.equal(value, null); return query },
        async maybeSingle() {
          const first = reads.length === 0
          reads.push(table)
          return { data: first ? initial : after, error: first ? readError : afterError }
        },
      }
      return query
    }
    return db
  }

  let db = addressClient()
  assert.equal((await guardarEdicionPersona(db, parsed())).ok, true)
  assert.equal(db.writes[0].args.p_domicilio, null, 'Saving another section must leave the stored address untouched')
  assert.deepEqual(db.reads, ['personas'])

  db = addressClient()
  const result = await guardarEdicionPersona(db, data())
  assert.equal(result.ok, true)
  assert.deepEqual(db.writes[0].args.p_domicilio, actualizado, 'All address fields must reach the existing RPC without version metadata')
  assert.equal(db.writes[0].args.p_domicilio.numero, 'S/N')
  assert.equal(db.writes[0].args.p_domicilio.piso, '0')
  assert.equal(db.reads.filter((table) => table === 'persona_domicilios').length, 2, 'Read both current address and the stored result')

  for (const [options, values, snapshot] of [
    [{ readError: { message: 'INTERNAL_ADDRESS' } }, actualizado, versionDomicilio(anterior)],
    [{}, actualizado, ''],
    [{ initial: { ...anterior, numero: 'Nuevo valor de otra sesión' } }, actualizado, versionDomicilio(anterior)],
    [{ initial: { ...anterior, casa: 'Otra casa' } }, actualizado, versionDomicilio(anterior)],
    [{ initial: { ...anterior, torre: 'Otra torre' } }, actualizado, versionDomicilio(anterior)],
    [{}, Object.fromEntries(DOMICILIO_FIELDS.map((field) => [field, ''])), versionDomicilio(anterior)],
  ]) {
    db = addressClient(options)
    const failed = await guardarEdicionPersona(db, data(values, snapshot))
    assert.equal(failed.ok, false)
    assert.equal(db.writes.length, 0, 'Unreadable, stale or accidentally emptied address must not be written')
    assert.equal(JSON.stringify(failed).includes('INTERNAL_ADDRESS'), false)
  }

  for (const options of [{ after: anterior }, { after: null }, { afterError: { message: 'INTERNAL_ADDRESS' } }]) {
    db = addressClient(options)
    const failed = await guardarEdicionPersona(db, data())
    assert.equal(failed.ok, false, 'An RPC success without the expected stored address is not a confirmed address update')
    assert.match(failed.message, /La ficha se guardó, pero no se pudo confirmar el domicilio/)
    assert.equal(db.writes.length, 1)
  }
  for (const campo of ['casa','torre']) {
    const cambio = { ...actualizado, [campo]: 'Nuevo valor' }
    db = addressClient({ after: cambio })
    assert.equal((await guardarEdicionPersona(db, data(cambio))).ok, true)
    assert.deepEqual(db.writes[0].args.p_domicilio, cambio)
    db = addressClient({ after: { ...cambio, [campo]: null } })
    assert.equal((await guardarEdicionPersona(db, data(cambio))).ok, false, 'A lost Casa/Torre is not a confirmed save')
  }
  db = addressClient({ after: anterior })
  assert.equal((await guardarEdicionPersona(db, data(anterior))).ok, true)
  assert.equal(db.writes[0].args.p_domicilio, null, 'An unchanged address must never create a lossy new version')
  console.log('Domicilio: conserva al guardar otras secciones, versión vigente, todos los campos, fallos de lectura y comprobación posterior: OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
