#!/usr/bin/env bash
set -euo pipefail
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus
export XMODIFIERS=@im=ibus
export INKSTONE_SYSTEM_IME=1
ibus-daemon --daemonize --replace --xim
for attempt in $(seq 1 30); do
  if ibus engine libpinyin; then break; fi
  sleep 0.2
done
ibus engine
export IBUS_ADDRESS="$(ibus address)"
npx playwright test --config playwright.desktop.config.js --grep 'real Linux IBus'
