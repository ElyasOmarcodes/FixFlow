import { copyFile, readFile, writeFile } from 'node:fs/promises'

const base = 'android/app/src/main'
await copyFile('native/android/FixFlowFilePlugin.java', `${base}/java/com/fixflow/app/FixFlowFilePlugin.java`)
await writeFile(`${base}/java/com/fixflow/app/MainActivity.java`, `package com.fixflow.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FixFlowFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`)
const manifestPath = `${base}/AndroidManifest.xml`
let manifest = await readFile(manifestPath, 'utf8')
manifest = manifest.replace(/ android:usesCleartextTraffic="[^"]*"/g, '')
manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="false"')
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace('<application', '<uses-permission android:name="android.permission.INTERNET" /><application')
}
await writeFile(manifestPath, manifest)
