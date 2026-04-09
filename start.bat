@echo off
title aCAPSULA - Sistema de Gestao de Estoque
chcp 65001 > nul

echo.
echo  aCAPSULA - Sistema de Gestao de Estoque Medico
echo  ================================================
echo.

set BASE=%~dp0

:: Instala dependencias do backend se necessario
if not exist "%BASE%backend\node_modules" (
  echo [1/2] Instalando dependencias do backend...
  cd /d "%BASE%backend"
  call npm install
  echo.
)

:: Instala dependencias do frontend se necessario
if not exist "%BASE%frontend\node_modules" (
  echo [2/2] Instalando dependencias do frontend...
  cd /d "%BASE%frontend"
  call npm install
  echo.
)

:: Cria atalho na area de trabalho automaticamente
echo Criando atalho na area de trabalho...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\aCAPSULA.lnk'); ^
   $s.TargetPath = '%BASE%start.bat'; ^
   $s.WorkingDirectory = '%BASE%'; ^
   $s.Description = 'aCAPSULA - Sistema de Gestao de Estoque Medico'; ^
   $s.IconLocation = '%SystemRoot%\System32\shell32.dll,13'; ^
   $s.Save()" 2>nul

:: Descobre o IP da maquina na rede local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
  set IP=%%a
  goto :found_ip
)
:found_ip
set IP=%IP: =%

echo.
echo  =====================================================
echo   Sistema iniciado com sucesso!
echo  =====================================================
echo.
echo   Neste computador:  http://localhost:5173
echo.
if defined IP (
  echo   Outros computadores na mesma rede:
  echo   http://%IP%:5173
  echo.
  echo   (Copie o endereco acima e abra no navegador
  echo    dos outros computadores da clinica)
)
echo  =====================================================
echo.
echo  Feche esta janela para ENCERRAR o sistema.
echo.

:: Inicia o backend em segundo plano
start "aCAPSULA Backend" cmd /c "cd /d "%BASE%backend" && node server.js"

:: Aguarda o backend inicializar
timeout /t 3 /nobreak > nul

:: Inicia o frontend
start "aCAPSULA Frontend" cmd /c "cd /d "%BASE%frontend" && npm run dev"

:: Aguarda o frontend inicializar e abre o navegador
timeout /t 5 /nobreak > nul
start http://localhost:5173

pause
