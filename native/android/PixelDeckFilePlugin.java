package com.pixeldeck.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/** The system document picker grants access only to the file the user selects. */
@CapacitorPlugin(name = "PixelDeckFile")
public class PixelDeckFilePlugin extends Plugin {
    private boolean saving = false;

    @PluginMethod
    public synchronized void save(PluginCall call) {
        if (saving) { call.reject("Another save is in progress"); return; }
        if (call.getString("data") == null) { call.reject("Missing file data"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "export.png"));
        saving = true;
        try { startActivityForResult(call, intent, "fileSelected"); }
        catch (Exception error) { saving = false; call.reject("Could not open the save picker", error); }
    }

    @ActivityCallback
    private void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) { saving = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            saving = false;
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        // Encoding and document-provider IO must not block Android's UI thread.
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (stream == null) throw new java.io.IOException("Document provider is unavailable");
                stream.write(Base64.decode(call.getString("data"), Base64.DEFAULT));
                stream.flush();
            } catch (Exception error) {
                saving = false;
                call.reject("Could not save the file. Choose another location and retry.", error);
                return;
            }
            saving = false;
            JSObject response = new JSObject();
            response.put("cancelled", false);
            call.resolve(response);
        });
    }
}
