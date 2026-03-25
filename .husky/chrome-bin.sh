# Resuelve Chrome/Chromium para Karma (Linux sin google-chrome en PATH).
# Cargar con: . "$(dirname "$0")/chrome-bin.sh"
if [ -z "$CHROME_BIN" ]; then
  for c in chromium google-chrome-stable google-chrome; do
    if command -v "$c" >/dev/null 2>&1; then
      export CHROME_BIN="$(command -v "$c")"
      break
    fi
  done
fi
