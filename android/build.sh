#!/usr/bin/env bash
# Builds a signed Big Top Bonzo APK from ../index.html using only the Android SDK command-line tools.
# Usage (from Git Bash):  bash android/build.sh [versionCode] [versionName]
# Output: dist/BigTopBonzo-<versionName>.apk
set -euo pipefail

VCODE="${1:-1}"
VNAME="${2:-1.0}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SDK="${ANDROID_HOME:-${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
PLATFORM="$SDK/platforms/$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -t- -k2 -n | tail -1)"
JAR="$PLATFORM/android.jar"
TARGET_SDK="${PLATFORM##*-}"
OUT="$HERE/build"
KS="$HERE/bonzo-release.jks"
KSPROPS="$HERE/keystore.properties"
echo "build-tools: $BT"
echo "platform:    $PLATFORM (targetSdk $TARGET_SDK)"

rm -rf "$OUT"; mkdir -p "$OUT/assets" "$OUT/gen" "$OUT/obj" "$OUT/dex"

# 1. Game assets: the same index.html, with the pixel font bundled instead of loaded from Google Fonts
cp "$HERE/fonts/PressStart2P-Regular.ttf" "$OUT/assets/"
node -e '
  const fs = require("fs");
  let h = fs.readFileSync(process.argv[1], "utf8");
  const local = "<style>@font-face{font-family:\"Press Start 2P\";src:url(PressStart2P-Regular.ttf) format(\"truetype\");font-display:block}" +
                "#fsBtn{display:none!important}</style>";
  const before = h.length;
  h = h.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, local)
       .replace(/<link rel="manifest"[^>]*>\n?/, "");
  if (h.length === before) throw new Error("font link not found in index.html");
  fs.writeFileSync(process.argv[2], h);
' "$ROOT/index.html" "$OUT/assets/index.html"

# 2. Resources + manifest
"$BT/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest "$HERE/AndroidManifest.xml" \
  -R "$OUT/res.zip" -A "$OUT/assets" --java "$OUT/gen" --auto-add-overlay \
  --min-sdk-version 24 --target-sdk-version "$TARGET_SDK" --version-code "$VCODE" --version-name "$VNAME"

# 3. Java -> classes.dex
javac -nowarn -Xlint:-options -source 11 -target 11 -classpath "$JAR" -d "$OUT/obj" \
  $(find "$OUT/gen" "$HERE/src" -name '*.java')
cmd //c "$(cygpath -w "$BT/d8.bat")" --release --min-api 24 --lib "$(cygpath -w "$JAR")" \
  --output "$(cygpath -w "$OUT/dex")" $(find "$OUT/obj" -name '*.class' -exec cygpath -w {} \;)

# 4. Package, align, sign
cp "$OUT/base.apk" "$OUT/unaligned.apk"
(cd "$OUT/dex" && "$BT/aapt" add "$OUT/unaligned.apk" classes.dex >/dev/null)
"$BT/zipalign" -p -f 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"

if [ ! -f "$KS" ]; then
  PASS="$(node -e 'console.log(require("crypto").randomBytes(18).toString("base64url"))')"
  keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias bonzo \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Big Top Bonzo, O=prateekdravin-png" >/dev/null 2>&1
  printf 'storeFile=bonzo-release.jks\nstorePassword=%s\nkeyAlias=bonzo\n' "$PASS" > "$KSPROPS"
  echo "Created signing key: $KS (password in keystore.properties - back both up, never commit them)"
fi
PASS="$(grep '^storePassword=' "$KSPROPS" | cut -d= -f2-)"

mkdir -p "$ROOT/dist"
APK="$ROOT/dist/BigTopBonzo-$VNAME.apk"
cmd //c "$(cygpath -w "$BT/apksigner.bat")" sign --ks "$(cygpath -w "$KS")" --ks-pass "pass:$PASS" \
  --ks-key-alias bonzo --out "$(cygpath -w "$APK")" "$(cygpath -w "$OUT/aligned.apk")"
cmd //c "$(cygpath -w "$BT/apksigner.bat")" verify --verbose "$(cygpath -w "$APK")" | head -5
echo "APK: $APK ($(du -h "$APK" | cut -f1))"
