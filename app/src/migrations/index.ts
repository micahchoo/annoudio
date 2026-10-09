import * as migration_20261009_092954_initial from './20261009_092954_initial'
import * as migration_20261009_101056_phase5_admin from './20261009_101056_phase5_admin'
import * as migration_20261009_163307_phase5c_lifecycle from './20261009_163307_phase5c_lifecycle'

export const migrations = [
  {
    up: migration_20261009_092954_initial.up,
    down: migration_20261009_092954_initial.down,
    name: '20261009_092954_initial',
  },
  {
    up: migration_20261009_101056_phase5_admin.up,
    down: migration_20261009_101056_phase5_admin.down,
    name: '20261009_101056_phase5_admin',
  },
  {
    up: migration_20261009_163307_phase5c_lifecycle.up,
    down: migration_20261009_163307_phase5c_lifecycle.down,
    name: '20261009_163307_phase5c_lifecycle',
  },
]
