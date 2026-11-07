' Abre o Magistrado sem janela de terminal. O atalho da Área de Trabalho e a atualização pelo app usam este arquivo.
' Roda "npm.cmd run start" na pasta app/ com a janela escondida (0) e sem esperar (False).
Set fso = CreateObject("Scripting.FileSystemObject")
app = fso.BuildPath(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)), "app")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = app
sh.Run "cmd.exe /c npm.cmd run start", 0, False
