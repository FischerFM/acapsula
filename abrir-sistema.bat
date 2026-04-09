@echo off
title aCAPSULA - Abrir Sistema
chcp 65001 > nul

echo.
echo  aCAPSULA - Abrindo sistema...
echo.

:: ============================================================
::  INSTRUCAO: substitua o IP abaixo pelo IP do computador
::  servidor (aquele onde o sistema esta instalado).
::  Para descobrir o IP do servidor, abra o start.bat nele
::  e anote o endereco mostrado em "Outros computadores".
:: ============================================================
set SERVIDOR_IP=COLOQUE_O_IP_AQUI

if "%SERVIDOR_IP%"=="COLOQUE_O_IP_AQUI" (
  echo  [ATENCAO] Configure o IP do servidor neste arquivo!
  echo.
  echo  1. Abra o arquivo "abrir-sistema.bat" com o Bloco de Notas
  echo  2. Substitua COLOQUE_O_IP_AQUI pelo IP do servidor
  echo     Exemplo: set SERVIDOR_IP=192.168.1.10
  echo.
  echo  Dica: O IP aparece na tela quando voce abre o start.bat
  echo  no computador servidor.
  echo.
  pause
  exit /b
)

:: Cria atalho na area de trabalho deste computador
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\aCAPSULA.lnk'); ^
   $s.TargetPath = '%~f0'; ^
   $s.WorkingDirectory = '%~dp0'; ^
   $s.Description = 'aCAPSULA - Sistema de Gestao de Estoque Medico'; ^
   $s.IconLocation = '%SystemRoot%\System32\shell32.dll,13'; ^
   $s.Save()" 2>nul

start http://%SERVIDOR_IP%:5173
