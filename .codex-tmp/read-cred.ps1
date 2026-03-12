 = @'
using System;
using System.Runtime.InteropServices;
namespace C {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist; public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  public static class N {
    [DllImport(""Advapi32.dll"", EntryPoint = ""CredReadW"", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport(""Advapi32.dll"", EntryPoint = ""CredFree"", SetLastError = true)]
    public static extern void CredFree([In] IntPtr cred);
  }
}
'@
Add-Type -TypeDefinition 
Write-Output 'type-loaded'
=[IntPtr]::Zero
=[C.N]::CredRead('LegacyGeneric:target=Supabase CLI:supabase',1,0,[ref])
Write-Output ("ok="+)
Write-Output ("err="+[Runtime.InteropServices.Marshal]::GetLastWin32Error())
if(){
  =[Runtime.InteropServices.Marshal]::PtrToStructure(,[type][C.CREDENTIAL])
  Write-Output ("target="+.TargetName)
  Write-Output ("user="+.UserName)
  Write-Output ("blob="+.CredentialBlobSize)
  if(.CredentialBlobSize -gt 0){ =[Runtime.InteropServices.Marshal]::PtrToStringUni(.CredentialBlob,.CredentialBlobSize/2); Write-Output ("prefix="+.Substring(0,[Math]::Min(30,.Length))); Write-Output ("secret="+) }
  [C.N]::CredFree()
}
