@echo off
rem Double-click to rebuild assets\data\projects.json from the master spreadsheet,
rem tools\data\projects.private.csv (git-ignored, so it's never published).
rem To convert a different file, drag it onto this one.
setlocal
cd /d "%~dp0.."

set "CSV=%~1"
if "%CSV%"=="" set "CSV=tools\data\projects.private.csv"

rem Node from PATH, or the per-user install in %LOCALAPPDATA%\Programs\nodejs.
set "NODE=node"
where node >nul 2>nul || set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not exist "%NODE%" if not "%NODE%"=="node" (
  echo Node.js wasn't found. Install Node 22 or later, then try again.
  goto end
)
if not exist "%CSV%" (
  echo Can't find the spreadsheet: %CSV%
  goto end
)

echo Converting %CSV% ...
echo.
"%NODE%" tools\csv-to-projects.mjs "%CSV%"
echo.
if errorlevel 1 (
  echo Nothing was written. Fix the error above and run this again.
) else (
  echo Done. Preview the site, then commit and push assets\data\projects.json.
)

:end
echo.
pause
