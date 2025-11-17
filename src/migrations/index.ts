import * as migration_20251117_122558 from './20251117_122558';
import * as migration_20251117_141115 from './20251117_141115';

export const migrations = [
  {
    up: migration_20251117_122558.up,
    down: migration_20251117_122558.down,
    name: '20251117_122558',
  },
  {
    up: migration_20251117_141115.up,
    down: migration_20251117_141115.down,
    name: '20251117_141115'
  },
];
