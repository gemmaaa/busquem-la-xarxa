<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="Content-Style-Type" content="text/css">
  <title></title>
  <meta name="Generator" content="Cocoa HTML Writer">
  <meta name="CocoaVersion" content="2685.7">
  <style type="text/css">
    p.p1 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica}
    p.p2 {margin: 0.0px 0.0px 0.0px 0.0px; font: 12.0px Helvetica; min-height: 14.0px}
  </style>
</head>
<body>
<p class="p1">const CACHE = "bib-v1";</p>
<p class="p1">const ASSETS = [</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./",</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./index.html",</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./style.css",</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./app.js",</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./i18n.json",</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./manifest.json",</p>
<p class="p1"><span class="Apple-converted-space">  </span>"./data/libraries.json",</p>
<p class="p1">];</p>
<p class="p2"><br></p>
<p class="p1">self.addEventListener("install", (e) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">  </span>e.waitUntil(caches.open(CACHE).then((c) =&gt; c.addAll(ASSETS)));</p>
<p class="p1">});</p>
<p class="p2"><br></p>
<p class="p1">self.addEventListener("activate", (e) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">  </span>e.waitUntil(</p>
<p class="p1"><span class="Apple-converted-space">    </span>caches.keys().then((keys) =&gt;</p>
<p class="p1"><span class="Apple-converted-space">      </span>Promise.all(keys.filter((k) =&gt; k !== CACHE).map((k) =&gt; caches.delete(k)))</p>
<p class="p1"><span class="Apple-converted-space">    </span>)</p>
<p class="p1"><span class="Apple-converted-space">  </span>);</p>
<p class="p1">});</p>
<p class="p2"><br></p>
<p class="p1">self.addEventListener("fetch", (e) =&gt; {</p>
<p class="p1"><span class="Apple-converted-space">  </span>e.respondWith(</p>
<p class="p1"><span class="Apple-converted-space">    </span>caches.match(e.request).then((r) =&gt; r || fetch(e.request))</p>
<p class="p1"><span class="Apple-converted-space">  </span>);</p>
<p class="p1">});</p>
</body>
</html>
