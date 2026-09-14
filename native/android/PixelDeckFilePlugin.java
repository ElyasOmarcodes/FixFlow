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
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.UUID;

/** Bounded bridge transfers; the document picker grants access to one chosen file. */
@CapacitorPlugin(name = "PixelDeckFile")
public class PixelDeckFilePlugin extends Plugin {
    private File pending;
    private String session;
    private boolean picking;

    private synchronized void clear() {
        if (pending != null) pending.delete();
        pending = null;
        session = null;
        picking = false;
    }

    private boolean valid(PluginCall call) {
        return pending != null && session != null && session.equals(call.getString("session"));
    }

    @PluginMethod
    public synchronized void begin(PluginCall call) {
        if (pending != null) { call.reject("Another save is in progress"); return; }
        try {
            pending = File.createTempFile("pixeldeck-export-", ".tmp", getContext().getCacheDir());
            session = UUID.randomUUID().toString();
            JSObject response = new JSObject();
            response.put("session", session);
            call.resolve(response);
        } catch (Exception error) { clear(); call.reject("Could not prepare export", error); }
    }

    @PluginMethod
    public void append(PluginCall call) {
        getBridge().execute(() -> {
            synchronized (this) {
                if (!valid(call) || picking) { call.reject("Invalid export session"); return; }
                String data = call.getString("data");
                if (data == null || data.length() > 180000) { call.reject("Invalid export chunk"); return; }
                try (FileOutputStream stream = new FileOutputStream(pending, true)) {
                    stream.write(Base64.decode(data, Base64.DEFAULT));
                    call.resolve();
                } catch (Exception error) { clear(); call.reject("Could not write export chunk", error); }
            }
        });
    }

    @PluginMethod
    public synchronized void cancel(PluginCall call) {
        if (valid(call) && !picking) clear();
        call.resolve();
    }

    @PluginMethod
    public synchronized void finish(PluginCall call) {
        if (!valid(call) || picking) { call.reject("Invalid export session"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "export.png"));
        picking = true;
        try { startActivityForResult(call, intent, "fileSelected"); }
        catch (Exception error) { clear(); call.reject("Could not open the save picker", error); }
    }

    @ActivityCallback
    private void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) { clear(); return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            clear();
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        getBridge().execute(() -> {
            synchronized (this) {
                if (!valid(call)) { call.reject("Export session expired"); clear(); return; }
                try (FileInputStream input = new FileInputStream(pending);
                     OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                    if (output == null) throw new java.io.IOException("Document provider is unavailable");
                    byte[] buffer = new byte[65536];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    output.flush();
                } catch (Exception error) {
                    clear();
                    call.reject("Could not save the file. Choose another location and retry.", error);
                    return;
                }
                clear();
                JSObject response = new JSObject();
                response.put("cancelled", false);
                call.resolve(response);
            }
        });
    }
}
