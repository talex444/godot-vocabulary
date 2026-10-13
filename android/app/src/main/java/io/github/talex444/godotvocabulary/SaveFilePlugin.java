package io.github.talex444.godotvocabulary;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Export inside the package: the WebView cannot download a blob, so the app hands the export text
 * here and Android's own "Save as" screen picks where the file goes. No storage permission needed.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        if (name == null || call.getString("text") == null) {
            call.reject("A file name and text are required.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        JSObject out = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            out.put("saved", false);
            call.resolve(out);
            return;
        }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) throw new java.io.IOException("Android gave no file to write to.");
            stream.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
            out.put("saved", true);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("The file could not be written: " + e.getMessage());
        }
    }
}
