Bump the framework version across all managed files.

Run `node scripts/version-bump.js $ARGUMENTS` from the project root.

Arguments: `<patch|minor|major> [--modules mod1,mod2] [--dry-run]`

Examples:
- `/kratos-version-bump patch` — bump patch version in all 6 global files
- `/kratos-version-bump minor --modules core,dev` — bump minor + update core and dev module configs
- `/kratos-version-bump major --dry-run` — preview major bump without writing

After a successful bump, run `/kratos-build-configs` to regenerate resolved configs.
