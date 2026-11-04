### Production debugging guard in the unified Taher workflow

`build-taher.yml` dumps the signed APK resource table to a temporary file, then refuses publication
if `string/hm_devtools` exists. It does not set `HM_DEVTOOLS`; the build script also refuses that
variable together with `KEYSTORE`. `test_devtools_guard.sh` checks this active workflow instead of
the removed original `release.yml`. This keeps the existing production-debugging checks working
after the APK workflows were consolidated.
