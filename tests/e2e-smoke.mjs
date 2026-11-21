const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

async function checkRoute(pathname) {
  const res = await fetch(`${BASE_URL}${pathname}`);
  if (!res.ok) {
    throw new Error(`Ruta ${pathname} respondió HTTP ${res.status}`);
  }
  const body = await res.text();
  if (!body || body.length < 40) {
    throw new Error(`Ruta ${pathname} devolvió respuesta vacía.`);
  }
  return res.status;
}

async function run() {
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`/api/health falló con estado ${healthRes.status}`);
  }
  const health = await healthRes.json();
  console.log('Health OK:', health);

  for (const route of ['/', '/consejeros', '/comisiones', '/portal']) {
    const status = await checkRoute(route);
    console.log(`Route ${route} -> HTTP ${status}`);
  }
  console.log('Smoke test E2E completado sin errores.');
}

run().catch((err) => {
  console.error('Fallo smoke test E2E:', err.message);
  process.exit(1);
});
