"""Real Server Component renders; synthetic Auth only, no database or credentials."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
import os
from urllib.request import Request, urlopen

from ui_preview import preview_server

CLIENT = '''let instances = 0
export function createServerClient(_url:any,_key:any,options:any) {
  const jar = options.cookies.getAll()
  const cookie = (name:string) => jar.find((item:any)=>item.name===name)?.value
  const account = cookie('demo-account') ?? 'alpha'
  const allowed = cookie('demo-admin') === '1'
  const expired = cookie('demo-expired') === '1'
  const calls:Record<string,number> = {}
  const count = (key:string) => calls[key] = (calls[key] ?? 0)+1
  return {
    instance: ++instances, calls,
    auth: {
      async getUser() {count('user');return {data:{user:{id:account,factors:[]}},error:null}},
      mfa:{async getAuthenticatorAssuranceLevel(){count('mfa');return {data:{currentLevel:'aal1',nextLevel:'aal1'},error:null}}},
    },
    async rpc(name:string) {
      count(name)
      if(name==='verificar_mfa_opcional')return {data:null,error:expired?{code:'PT401'}:null}
      if(!name.startsWith('can_'))throw new Error('Unexpected RPC')
      return {data:allowed,error:null}
    },
  }
}
'''

PAGE = '''import { createClient } from '@/utils/supabase/server'
import { usuarioVerificado } from '@/lib/auth/usuario-server'
import { estadoMfa } from '@/lib/auth/mfa-server'
import { comprobarSesionDatos } from '@/lib/auth/session-server'
import { permisosLicencias } from '@/lib/licencias/server'
import { permisosNovedades } from '@/lib/novedades/server'
async function read() {
  const client = await createClient()
  const {data:{user}} = await usuarioVerificado(client)
  const [mfa,session,permissions,control] = await Promise.all([
    estadoMfa(client,user!),comprobarSesionDatos(client),permisosLicencias(client),permisosNovedades(client),
  ])
  return {user:user!.id,mfa,session,admin:permissions.administrar,confirmar:control.confirmar}
}
export default async function Page() {
  const client = await createClient() as any
  const observations = await Promise.all([read(),read(),read()])
  return <pre id="result">{JSON.stringify({instance:client.instance,calls:client.calls,observations})}</pre>
}
'''


class Result(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.value = ''

    def handle_starttag(self, tag, attrs):
        if tag == 'pre' and ('id', 'result') in attrs:
            self.inside = True

    def handle_endtag(self, tag):
        if tag == 'pre':
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.value += data


def main():
    # The client factory is replaced below. Keep even configuration synthetic.
    env = {'NEXT_PUBLIC_SUPABASE_URL': 'https://example.supabase.co', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': 'synthetic'}
    previous = {key: os.environ.get(key) for key in env}
    os.environ.update(env)
    try:
        with preview_server('server-cache', PAGE, 3115, extra_files={'fixtures/client.ts': CLIENT},
                            aliases={'@supabase/ssr': ['./fixtures/client.ts']}) as (origin, _artifacts):
            def read(account, admin=False, expired=False):
                request = Request(origin, headers={'Cookie': f'demo-account={account}; demo-admin={int(admin)}; demo-expired={int(expired)}'})
                with urlopen(request, timeout=30) as response:
                    parser = Result()
                    parser.feed(response.read().decode())
                value = json.loads(parser.value)
                expected = {'user': account, 'mfa': 'none', 'session': 'expired' if expired else 'active', 'admin': admin, 'confirmar': admin}
                assert value['observations'] == [expected]*3, value
                assert len(value['calls']) == 9 and all(count == 1 for count in value['calls'].values()), value
                return value

            first = read('alpha', True)
            revoked = read('alpha', False, True)
            assert first['instance'] != revoked['instance'], 'Never reuse a server client across requests'
            with ThreadPoolExecutor(max_workers=4) as pool:
                futures = [pool.submit(read, f'account-{index}', index % 2 == 0) for index in range(8)]
                values = [future.result() for future in futures]
            assert len({value['instance'] for value in values}) == len(values)
            print('Cache SSR: una verificación por render, solicitudes concurrentes aisladas y permisos/vencimiento frescos en la siguiente solicitud: OK')
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


if __name__ == '__main__':
    main()
