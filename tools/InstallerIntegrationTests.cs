using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32;
using System.IO.Compression;
using System.Text;
using System.Linq;
static class InstallerIntegrationTests {
 static int checks;
 static void Check(bool value,string description){if(!value)throw new Exception(description);checks++;Console.WriteLine("PASS "+description);}
 static MemoryStream FailedUpdate(){var stream=new MemoryStream();using(var archive=new ZipArchive(stream,ZipArchiveMode.Create,true))using(var writer=new StreamWriter(archive.CreateEntry("CodexStartup.exe").Open(),new UTF8Encoding(false))){writer.Write("new runtime that must roll back");}stream.Position=0;return stream;}
 static int Main(string[] args){
  string testBase=args.Length>1?Path.GetFullPath(args[1]):Path.GetTempPath();
  string temporary=Path.Combine(testBase,"it-"+Guid.NewGuid().ToString("N").Substring(0,12)),root=Path.Combine(temporary,"用户资料 \uD83D\uDE00 空格","应用"),desktop=Path.Combine(temporary,"桌面"),menu=Path.Combine(temporary,"开始菜单");
  string registry="Software\\CodexStartupWindowsTests\\"+Guid.NewGuid().ToString("N");
  bool filesOnly=args.Contains("--files-only");
  try{
   // Only inspect our generated embedded ZIP; do not execute installer code or
   // depend on LoadFile's inherited directory trust-zone classification.
   var assembly=Assembly.ReflectionOnlyLoad(File.ReadAllBytes(Path.GetFullPath(args[0])));
   using(var payload=assembly.GetManifestResourceStream("payload.zip")){Check(payload!=null,"installer contains embedded runtime ZIP");InstallCore.Install(payload,root,null,Path.GetFullPath(args[0]));}
   Check(File.Exists(Path.Combine(root,"CodexStartup.exe"))&&File.Exists(Path.Combine(root,"runtime","boot.mjs")),"real embedded runtime installs into Unicode path");
   Check(File.Exists(Path.Combine(root,"CodexStartupSetup.exe")),"installed setup retained for uninstall");
   if(filesOnly){
    File.WriteAllText(Path.Combine(root,"user-note.txt"),"preserve me");
    InstallCore.Uninstall(root,null);
    Check(File.Exists(Path.Combine(root,"user-note.txt")),"file-only uninstall preserves unowned data");
    Check(!File.Exists(Path.Combine(root,"CodexStartup.exe")),"file-only uninstall removes owned launcher");
    Console.WriteLine("File-only integration checks="+checks+"; shell/registry intentionally not tested");return 0;
   }
   Console.WriteLine("Diagnostic shortcut path: "+Path.Combine(desktop,"鲸鱼工作台.lnk"));
   Console.WriteLine("Diagnostic target path: "+Path.Combine(root,"CodexStartup.exe"));
   InstallIntegration.Register(root,desktop,menu,registry);
   byte[] originalLauncher=File.ReadAllBytes(Path.Combine(root,"CodexStartup.exe")),originalLink=File.ReadAllBytes(Path.Combine(desktop,"鲸鱼工作台.lnk"));
   bool failed=false;
   using(var update=FailedUpdate()){try{InstallCore.Install(update,root,null,Path.GetFullPath(args[0]),()=>InstallIntegration.Register(root,desktop,menu,registry,name=>{if(name=="registry")throw new IOException("injected registry failure");}));}catch(IOException){failed=true;}}
   Check(failed,"registry failure after shortcut writes aborts the complete install");
   Check(File.ReadAllBytes(Path.Combine(root,"CodexStartup.exe")).SequenceEqual(originalLauncher),"shell failure restores original installed runtime");
   Check(File.ReadAllBytes(Path.Combine(desktop,"鲸鱼工作台.lnk")).SequenceEqual(originalLink),"shell failure restores original shortcut bytes");
   using(var start=new ShellShortcut(Path.Combine(desktop,"鲸鱼工作台.lnk"))){
    Check(start.TargetPath==Path.Combine(root,"CodexStartup.exe"),"desktop shortcut targets installed launcher");
    Check(start.Description=="一小片海","desktop shortcut shows the requested tooltip");
    Check(start.IconLocation.StartsWith(root),"shortcut icon uses stable installed path");
   }
   Check(!File.Exists(Path.Combine(desktop,"鲸鱼工作台 设置.lnk")),"new install has only one desktop shortcut");
   string legacyFile=Path.Combine(desktop,"鲸鱼工作台 设置.lnk");
   using(var legacy=new ShellShortcut(legacyFile)){legacy.TargetPath=Path.Combine(root,"CodexStartup.exe");legacy.Arguments="--settings";legacy.WorkingDirectory=root;legacy.IconLocation=legacy.TargetPath+",0";legacy.Save();}
   InstallIntegration.Register(root,desktop,menu,registry);
   Check(!File.Exists(legacyFile),"upgrade removes an owned legacy settings shortcut");
   using(var customized=new ShellShortcut(legacyFile)){customized.TargetPath=Path.Combine(root,"CodexStartup.exe");customized.Arguments="--user-customized-argument";customized.WorkingDirectory=root;customized.IconLocation=customized.TargetPath+",0";customized.Save();}
   InstallIntegration.Register(root,desktop,menu,registry);
   Check(File.Exists(legacyFile),"upgrade preserves a user-customized legacy shortcut");
   using(var key=Registry.CurrentUser.OpenSubKey(registry)){Check((string)key.GetValue("InstallLocation")==root,"uninstall registration points to the user install");}
   InstallIntegration.Remove(root,desktop,menu,registry);
   Check(!File.Exists(Path.Combine(desktop,"鲸鱼工作台.lnk")),"uninstall removes owned shortcut");
   Check(File.Exists(Path.Combine(desktop,"鲸鱼工作台 设置.lnk")),"uninstall preserves shortcut arguments customized by user");
   using(var key=Registry.CurrentUser.OpenSubKey(registry)){Check(key==null,"uninstall removes its registry entry");}
   InstallCore.Uninstall(root,null);Check(!Directory.Exists(root),"real runtime uninstall removes an empty installation");
   Console.WriteLine("Installer integration checks="+checks);return 0;
  }catch(Exception error){Console.Error.WriteLine(error);return 1;}
  finally{if(!filesOnly)Registry.CurrentUser.DeleteSubKeyTree(registry,false);if(Directory.Exists(temporary))Directory.Delete(temporary,true);}
 }
}

