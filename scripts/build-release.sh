#!/usr/bin/env bash
# Gera o build de release do Android assinado com a keystore de upload (fora do git).
#   scripts/build-release.sh aab   -> AAB para a Play Store  (padrão)
#   scripts/build-release.sh apk   -> APK para instalar direto
# Requer: ~/.config/preceptoria/keystore.properties e upload-keystore.jks, Node >= 22.13, JDK 17 e Android SDK.
set -euo pipefail
cd "$(dirname "$0")/.."

KIND="${1:-aab}"
PROPS="$HOME/.config/preceptoria/keystore.properties"
[[ -f "$PROPS" ]] || { echo "Keystore não encontrada em $PROPS" >&2; exit 1; }

source "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://preceptoria.bibliafoco.com.br}" CI=1
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(which java)")")")}"

npx expo prebuild --platform android --clean --no-install

# O prebuild reescreve os scripts android/ios do package.json: restaura.
python3 - <<'PY'
import json
p='package.json'; d=json.load(open(p))
d['scripts']['android']='expo start --android'; d['scripts']['ios']='expo start --ios'
json.dump(d,open(p,'w'),indent=2,ensure_ascii=False); open(p,'a').write('\n')
PY

# Assinatura de release com a keystore de upload.
python3 - <<'PY'
p='android/app/build.gradle'
s=open(p).read()
s=s.replace("android {\n","""def keystoreProps = new Properties()
def keystoreFile = file("${System.getProperty('user.home')}/.config/preceptoria/keystore.properties")
if (keystoreFile.exists()) keystoreProps.load(new FileInputStream(keystoreFile))

android {
""",1)
s=s.replace("""    signingConfigs {
        debug {""","""    signingConfigs {
        release {
            if (keystoreProps['storeFile']) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
        debug {""",1)
s=s.replace("""            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug""","""            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig keystoreProps['storeFile'] ? signingConfigs.release : signingConfigs.debug""",1)
open(p,'w').write(s)
PY
grep -q "signingConfigs.release" android/app/build.gradle || { echo "Falha ao configurar a assinatura" >&2; exit 1; }

echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
TASK=bundleRelease; [[ "$KIND" == "apk" ]] && TASK=assembleRelease
./gradlew "$TASK" -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --no-daemon -Dorg.gradle.jvmargs="-Xmx2g -XX:MaxMetaspaceSize=512m"
