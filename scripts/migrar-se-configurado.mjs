// Aplica as atualizações do banco (db/migrations) ao iniciar, mas só quando a credencial privada de migração
// (FISCOIA_MIGRATION_DATABASE_URL) estiver cadastrada no Render. Sem ela, não faz nada. Nunca impede o sistema de abrir.
import { spawnSync } from 'node:child_process';

if (!String(process.env.FISCOIA_MIGRATION_DATABASE_URL || '').trim()) {
  console.log('Migrações automáticas desligadas (FISCOIA_MIGRATION_DATABASE_URL não cadastrada).');
} else {
  const r = spawnSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit', timeout: 60_000 });
  console.log(r.status === 0 ? 'Migrações do banco em dia.' : 'As migrações não foram aplicadas; o sistema abre assim mesmo. Veja a mensagem acima.');
}
process.exit(0);
