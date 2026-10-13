package io.github.talex444.godotvocabulary;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (Export's "Save as"); registered before the bridge starts.
        registerPlugin(SaveFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
