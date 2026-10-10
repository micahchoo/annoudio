import * as migration_20261009_092954_initial from './20261009_092954_initial';
import * as migration_20261009_101056_phase5_admin from './20261009_101056_phase5_admin';
import * as migration_20261009_163307_phase5c_lifecycle from './20261009_163307_phase5c_lifecycle';
import * as migration_20261009_201203_invite_codes from './20261009_201203_invite_codes';
import * as migration_20261009_211922_vocab_profile from './20261009_211922_vocab_profile';
import * as migration_20261009_230524_rework from './20261009_230524_rework';
import * as migration_20261010_012444_audit_fixes from './20261010_012444_audit_fixes';

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
  {
    up: migration_20261009_201203_invite_codes.up,
    down: migration_20261009_201203_invite_codes.down,
    name: '20261009_201203_invite_codes',
  },
  {
    up: migration_20261009_211922_vocab_profile.up,
    down: migration_20261009_211922_vocab_profile.down,
    name: '20261009_211922_vocab_profile',
  },
  {
    up: migration_20261009_230524_rework.up,
    down: migration_20261009_230524_rework.down,
    name: '20261009_230524_rework',
  },
  {
    up: migration_20261010_012444_audit_fixes.up,
    down: migration_20261010_012444_audit_fixes.down,
    name: '20261010_012444_audit_fixes'
  },
];
