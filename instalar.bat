@echo off
title aCAPSULA - Instalacao
chcp 65001 > nul

echo.
echo  aCAPSULA - Instalacao do Sistema
echo  =====================================
echo.

set BASE=%~dp0

:: Verifica se Node.js esta instalado
node --version > nul 2>&1
if errorlevel 1 (
  echo  [ERRO] Node.js nao encontrado!
  echo.
  echo  Voce precisa instalar o Node.js primeiro.
  echo  Abrindo a pagina de download...
  echo.
  echo  IMPORTANTE: Na instalacao do Node.js,
  echo  marque a opcao "Add to PATH"
  echo.
  pause
  start https://nodejs.org/en/download
  echo.
  echo  Apos instalar o Node.js, FECHE e abra
  echo  este arquivo novamente.
  echo.
  pause
  exit /b
)

for /f %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js encontrado: %NODE_VER%

:: Verifica versao minima (v22)
for /f "tokens=1 delims=." %%a in ("%NODE_VER:v=%") do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 22 (
  echo.
  echo  [AVISO] Versao do Node.js muito antiga: %NODE_VER%
  echo  O sistema requer Node.js v22 ou superior.
  echo  Abrindo pagina de download...
  start https://nodejs.org/en/download
  echo.
  pause
  exit /b
)

echo.
echo  [1/2] Instalando dependencias do backend...
cd /d "%BASE%backend"
call npm install
if errorlevel 1 (
  echo  [ERRO] Falha ao instalar backend. Verifique sua conexao com a internet.
  pause
  exit /b
)

echo.
echo  [2/2] Instalando dependencias do frontend...
cd /d "%BASE%frontend"
call npm install
if errorlevel 1 (
  echo  [ERRO] Falha ao instalar frontend. Verifique sua conexao com a internet.
  pause
  exit /b
)

:: Cria atalho na area de trabalho
echo.
echo  Criando atalho na area de trabalho...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\aCAPSULA.lnk'); ^
   $s.TargetPath = '%BASE%start.bat'; ^
   $s.WorkingDirectory = '%BASE%'; ^
   $s.Description = 'aCAPSULA - Sistema de Gestao de Estoque Medico'; ^
   $s.IconLocation = '%SystemRoot%\System32\shell32.dll,13'; ^
   $s.Save()" 2>nul

echo.
echo  =====================================================
echo   Instalacao concluida com sucesso!
echo  =====================================================
echo.
echo   Um atalho "aCAPSULA" foi criado na area de trabalho.
echo   Clique duas vezes nele para abrir o sistema.
echo.
echo   IMPORTANTE: Este computador precisa estar
echo   ligado para que os outros computadores da
echo   clinica consigam acessar o sistema.
echo  =====================================================
echo.
pause
