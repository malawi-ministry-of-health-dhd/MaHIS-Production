!macro customInstall
  nsExec::ExecToStack 'taskkill /IM "MaHIS.exe" /F'
!macroend

!macro customUnInstall
  nsExec::ExecToStack 'taskkill /IM "MaHIS.exe" /F'
!macroend
