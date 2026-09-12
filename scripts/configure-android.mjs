import { copyFile, readFile, writeFile } from 'node:fs/promises'

const base = 'android/app/src/main'
await copyFile('native/android/PixelDeckFilePlugin.java', `${base}/java/com/pixeldeck/app/PixelDeckFilePlugin.java`)
await writeFile(`${base}/java/com/pixeldeck/app/MainActivity.java`, `package com.pixeldeck.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PixelDeckFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`)
const manifestPath = `${base}/AndroidManifest.xml`
let manifest = await readFile(manifestPath, 'utf8')
manifest = manifest.replace(/ android:usesCleartextTraffic="[^"]*"/g, '')
manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="false"')
await writeFile(manifestPath, manifest)
