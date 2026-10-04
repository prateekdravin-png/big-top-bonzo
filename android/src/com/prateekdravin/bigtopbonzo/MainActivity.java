package com.prateekdravin.bigtopbonzo;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen WebView that plays the game from the website, so every update published
 * there reaches this app automatically (the site's service worker keeps an offline copy).
 * If the site can't be reached and nothing is cached yet, it falls back to the copy bundled
 * in the APK.
 */
public class MainActivity extends Activity {
    private static final String GAME_URL = "https://prateekdravin-png.github.io/big-top-bonzo/";
    private static final String GAME_HOST = "prateekdravin-png.github.io";
    private static final String BUNDLED_URL = "file:///android_asset/index.html";
    private WebView web;
    private boolean usingBundled = false;

    private void useBundledCopy() {
        if (usingBundled) return;
        usingBundled = true;
        web.loadUrl(BUNDLED_URL);
    }

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // keeps the high score
        s.setMediaPlaybackRequiresUserGesture(false); // music and sound effects
        s.setAllowFileAccess(true);                   // for the bundled fallback copy
        s.setUserAgentString(s.getUserAgentString() + " BigTopBonzoApp"); // lets the page know it's inside the app
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                return !(GAME_HOST.equals(u.getHost()) || "file".equals(u.getScheme())); // stay on the game only
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) useBundledCopy(); // offline with nothing cached yet
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse res) {
                if (req.isForMainFrame() && res.getStatusCode() >= 400) useBundledCopy();
            }
        });
        setContentView(web);
        hideSystemBars();

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(GAME_URL);
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        // pause the game itself so it's waiting on the pause screen when you come back
        web.evaluateJavascript("if (typeof state !== 'undefined' && state === 'play') { setState('pause'); MUS.stop(); }", null);
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
