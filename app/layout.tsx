import React from 'react';
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AutoSync } from '@/components/AutoSync'; // <-- 引入了自动同步组件
import { SiteIconProvider } from '@/components/SiteIconProvider';
import { TVProvider } from "@/lib/contexts/TVContext";
import { TVNavigationInitializer } from "@/components/TVNavigationInitializer";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PasswordGate } from "@/components/PasswordGate";
import { siteConfig } from "@/lib/config/site-config";
import { AdKeywordsInjector } from "@/components/AdKeywordsInjector";
import { BackToTop } from "@/components/ui/BackToTop";
import { ScrollPositionManager } from "@/components/ScrollPositionManager";
import { LocaleProvider } from "@/components/LocaleProvider";
import { RuntimeFeaturesProvider } from "@/components/RuntimeFeaturesProvider";
import { VideoTogetherController } from '@/components/VideoTogetherController';
import { shouldEnableVercelAnalytics } from '@/lib/config/deployment';
import { getRuntimeFeatures } from "@/lib/server/runtime-features";
import { resolveSiteIconSrc } from '@/lib/server/site-icon';
import fs from 'fs';
import path from 'path';

const DEFAULT_VIDEOTOGETHER_SCRIPT_URL =
  'https://fastly.jsdelivr.net/gh/VideoTogether/VideoTogether@latest/release/extension.website.user.js';

// Server Component specifically for reading env/file (async for best practices)
async function AdKeywordsWrapper() {
  let keywords: string[] = [];

  try {
    // 1. Try reading from file (Docker runtime support)
    const keywordsFile = process.env.AD_KEYWORDS_FILE;
    if (keywordsFile) {
      // Resolve absolute path or relative to CWD
      const filePath = path.isAbsolute(keywordsFile)
        ? keywordsFile
        : path.join(process.cwd(), keywordsFile);

      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        keywords = content.split(/[\n,]/).map((k: string) => k.trim()).filter((k: string) => k);
        console.log(`[AdFilter] Loaded ${keywords.length} keywords from file: ${filePath}`);
      } catch (fileError: unknown) {
        // Handle file not found (ENOENT) gracefully
        if ((fileError as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn('[AdFilter] Error reading keywords file:', fileError);
        }
      }
    }

    // 2. Fallback to Env var (Runtime or Build time)
    if (keywords.length === 0) {
      const envKeywords = process.env.AD_KEYWORDS || process.env.NEXT_PUBLIC_AD_KEYWORDS;
      if (envKeywords) {
        keywords = envKeywords.split(/[\n,]/).map((k: string) => k.trim()).filter((k: string) => k);
      }
    }
  } catch (error) {
    console.warn('[AdFilter] Failed to load keywords:', error);
  }

  return <AdKeywordsInjector keywords={keywords} />;
}

export async function generateMetadata(): Promise<Metadata> {
  const siteIconSrc = await resolveSiteIconSrc();

  return {
    title: siteConfig.title,
    description: siteConfig.description,
    icons: {
      icon: siteIconSrc,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteIconSrc = await resolveSiteIconSrc();
  const runtimeFeatures = getRuntimeFeatures();
  const videoTogetherScriptUrl =
    process.env.VIDEOTOGETHER_SCRIPT_URL?.trim() || DEFAULT_VIDEOTOGETHER_SCRIPT_URL;
  const videoTogetherSettingUrl = process.env.VIDEOTOGETHER_SETTING_URL?.trim();
  const videoTogetherEnvEnabled = process.env.VIDEOTOGETHER_ENABLED !== 'false';
  const vercelAnalyticsEnabled = shouldEnableVercelAnalytics();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Chrome 66 / Android 9 WebView polyfills */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  if(!Promise.allSettled)Promise.allSettled=function(ps){return Promise.all(ps.map(function(p){return Promise.resolve(p).then(function(v){return{status:'fulfilled',value:v}},function(r){return{status:'rejected',reason:r}})}))};
  if(!Promise.any)Promise.any=function(ps){return new Promise(function(res,rej){var e=[],n=0;ps=ps.map(function(p){return Promise.resolve(p)});n=ps.length;if(!n)rej(new AggregateError([],'All promises were rejected'));ps.forEach(function(p,i){p.then(res,function(r){e[i]=r;if(--n===0)rej(new AggregateError(e,'All promises were rejected'))})})})};
  if(!Array.prototype.flat)Array.prototype.flat=function(d){d=d===undefined?1:d;return this.reduce(function(a,v){return a.concat(d>0&&Array.isArray(v)?v.flat(d-1):v)},[])};
  if(!Array.prototype.flatMap)Array.prototype.flatMap=function(f,t){return this.map(f,t).flat(1)};
  if(!Object.fromEntries)Object.fromEntries=function(it){var o={};for(var e of it)o[e[0]]=e[1];return o};
  try{globalThis}catch(e){window.globalThis=window}
  if(typeof queueMicrotask==='undefined')window.queueMicrotask=function(fn){Promise.resolve().then(fn)};
  if(!Array.prototype.at){Array.prototype.at=function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;if(i<0||i>=this.length)return undefined;return this[i]}}
  if(!String.prototype.at){String.prototype.at=function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;if(i<0||i>=this.length)return undefined;return this[i]}}
  if(typeof structuredClone==='undefined')window.structuredClone=function(v){return JSON.parse(JSON.stringify(v))};
  if(!String.prototype.matchAll){String.prototype.matchAll=function(re){var str=this;if(typeof re==='string')re=new RegExp(re,'g');var flags=re.flags||'';if(flags.indexOf('g')<0)throw new TypeError('matchAll called with a non-global RegExp');var r=new RegExp(re.source,flags),results=[],m;while((m=r.exec(str))!==null){if(m.index===r.lastIndex)r.lastIndex++;results.push(m);}var i=0;var iter={next:function(){return i<results.length?{value:results[i++],done:false}:{value:undefined,done:true}}};if(typeof Symbol!=='undefined'&&Symbol.iterator)iter[Symbol.iterator]=function(){return iter};return iter;}};
})();
        ` }} />
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Apple PWA Support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="KVideo" />
        <link rel="apple-touch-icon" href={siteIconSrc} />
        {/* Theme Color (for browser address bar) */}
        <meta name="theme-color" content="#000000" />
        {/* Mobile viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <SiteIconProvider iconSrc={siteIconSrc}>
          <ThemeProvider>
            <RuntimeFeaturesProvider initialFeatures={runtimeFeatures}>
              <VideoTogetherController
                envEnabled={videoTogetherEnvEnabled}
                scriptUrl={videoTogetherScriptUrl}
                settingUrl={videoTogetherSettingUrl}
              />
              <LocaleProvider />

              <TVProvider>
                <TVNavigationInitializer />
                <PasswordGate hasAuth={!!(
                  process.env.ADMIN_PASSWORD ||
                  process.env.ACCOUNTS ||
                  process.env.ACCESS_PASSWORD ||
                  (
                    process.env.AUTH_SECRET &&
                    process.env.UPSTASH_REDIS_REST_URL &&
                    process.env.UPSTASH_REDIS_REST_TOKEN
                  )
                )}>
                  <AutoSync />
                  <AdKeywordsWrapper />
                  {children}
                  <BackToTop />
                  <ScrollPositionManager />
                </PasswordGate>
              </TVProvider>
              {vercelAnalyticsEnabled ? <Analytics /> : null}
              <ServiceWorkerRegister />
            </RuntimeFeaturesProvider>
          </ThemeProvider>
        </SiteIconProvider>

        {/* ARIA Live Region for Screen Reader Announcements */}
        <div
          id="aria-live-announcer"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {/* Google Cast SDK */}
        <script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" async />

        {/* Scroll Performance Optimization Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                let scrollTimer;
                const body = document.body;
                
                function handleScroll() {
                  body.classList.add('scrolling');
                  clearTimeout(scrollTimer);
                  scrollTimer = setTimeout(function() {
                    body.classList.remove('scrolling');
                  }, 150);
                }
                
                let ticking = false;
                window.addEventListener('scroll', function() {
                  if (!ticking) {
                    window.requestAnimationFrame(function() {
                      handleScroll();
                      ticking = false;
                    });
                    ticking = true;
                  }
                }, { passive: true });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
