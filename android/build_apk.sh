set -e
SDK=${ANDROID_SDK:-$HOME/Android/Sdk}; BT=$SDK/build-tools/34.0.0; JAR=$SDK/platforms/android-34/android.jar
Q=${AAPT_WRAP:-}
cd "$(dirname "$0")"
rm -rf out && mkdir -p out/classes out/dex
cp ../dist/index.html assets/index.html
$Q $BT/aapt2 compile --dir res -o out/res.zip
$Q $BT/aapt2 link -o out/base.apk -I $JAR --manifest AndroidManifest.xml -A assets out/res.zip --auto-add-overlay
javac --release 8 -classpath $JAR -d out/classes src/com/rexcodebase/ironshift/MainActivity.java 2>&1 | grep -v warning || true
java -cp $BT/lib/d8.jar com.android.tools.r8.D8 --lib $JAR --min-api 24 --output out/dex $(find out/classes -name '*.class')
cd out && cp base.apk unsigned.apk && zip -q -j unsigned.apk dex/classes.dex && cd ..
$Q $BT/zipalign -f -p 4 out/unsigned.apk out/aligned.apk
[ -f ks.jks ] || keytool -genkeypair -keystore ks.jks -alias rex -keyalg RSA -keysize 2048 -validity 10000 -storepass ${KS_PASS:-ironshift} -keypass ${KS_PASS:-ironshift} -dname "CN=REX-codebase, O=REX, C=IN" >/dev/null 2>&1
java -jar $BT/lib/apksigner.jar sign --ks ks.jks --ks-pass pass:${KS_PASS:-ironshift} --key-pass pass:${KS_PASS:-ironshift} --out out/IRONSHIFT.apk out/aligned.apk
java -jar $BT/lib/apksigner.jar verify --verbose out/IRONSHIFT.apk | head -4
ls -la out/IRONSHIFT.apk
