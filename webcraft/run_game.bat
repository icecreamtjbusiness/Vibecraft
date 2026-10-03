@echo off
rem ============================================================
rem  WebCraft - one-click launcher
rem  Starts a tiny local web server and opens the game in your
rem  default browser. (WebGL + pointer lock need http://, not
rem  file://, that's why we serve it locally.)
rem  Requires Python 3 from python.org (check "Add to PATH"
rem  during install) OR any of: py / python3 / node.
rem ============================================================
title WebCraft Launcher
cd /d "%~dp0"

set PORT=8765

where py >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/index.html"
    echo Starting WebCraft at http://localhost:%PORT%/ ... Close this window to stop.
    py -3 -m http.server %PORT%
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/index.html"
    echo Starting WebCraft at http://localhost:%PORT%/ ... Close this window to stop.
    python -m http.server %PORT%
    goto :eof
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/index.html"
    echo Starting WebCraft at http://localhost:%PORT%/ ... Close this window to stop.
    python3 -m http.server %PORT%
    goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/index.html"
    echo Starting WebCraft at http://localhost:%PORT%/ ... Close this window to stop.
    node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{let u=q.url.split('?')[0];if(u==='/')u='/index.html';const fp=p.join(process.cwd(),decodeURIComponent(u));f.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end('nf');return;}const ext=p.extname(fp);const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css'}[ext]||'application/octet-stream';s.writeHead(200,{'Content-Type':t});s.end(d);});}).listen(%PORT%,()=>console.log('WebCraft on http://localhost:%PORT%/'));"
    goto :eof
)

echo.
echo  [!] Neither Python nor Node.js was found on this computer.
echo      Install Python from https://www.python.org/downloads/
echo      (tick "Add python.exe to PATH") and run this file again.
echo.
pause
