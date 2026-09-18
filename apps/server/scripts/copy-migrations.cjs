// tsc compiles .ts and nothing else. The migrations are .sql files that the
// built server reads at startup, so the build copies them next to db.js.
// Node rather than `cp -R`, because part of the team builds on Windows.
const { cpSync } = require('node:fs');
const { join } = require('node:path');

const from = join(__dirname, '..', 'src', 'core', 'db', 'migrations');
const to = join(__dirname, '..', 'dist', 'core', 'db', 'migrations');
cpSync(from, to, { recursive: true });
