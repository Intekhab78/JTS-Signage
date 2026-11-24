package com.jts.signage;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;
    private int backTapCount = 0;
    private long lastBackTapMs = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        configureWebSettings(webView.getSettings());

        webView.addJavascriptInterface(new AndroidBridge(), "JTSSignageAndroid");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
        webView.requestFocus();
    }

    @SuppressWarnings("deprecation")
    private void configureWebSettings(WebSettings s) {
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }

    @SuppressWarnings("deprecation")
    private void applyImmersiveMode() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        applyImmersiveMode();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int code = event.getKeyCode();
            if (code == KeyEvent.KEYCODE_MENU
                    || code == KeyEvent.KEYCODE_INFO
                    || code == KeyEvent.KEYCODE_SETTINGS) {
                toggleSettingsOverlay();
                return true;
            }
            if (code == KeyEvent.KEYCODE_BACK) {
                long now = System.currentTimeMillis();
                if (now - lastBackTapMs > 3000L) {
                    backTapCount = 1;
                } else {
                    backTapCount++;
                }
                lastBackTapMs = now;
                if (backTapCount >= 5) {
                    backTapCount = 0;
                    toggleSettingsOverlay();
                }
                // Consume single Back presses so kiosk does not exit accidentally
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void toggleSettingsOverlay() {
        if (webView == null) return;
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(
                        "window.JTSSignageToggleSettings && window.JTSSignageToggleSettings();",
                        null);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getPlatform() {
            return "Android TV (" + Build.MANUFACTURER + " " + Build.MODEL + ")";
        }

        @JavascriptInterface
        public String getDeviceName() {
            return Build.MANUFACTURER + " " + Build.MODEL;
        }
    }
}
