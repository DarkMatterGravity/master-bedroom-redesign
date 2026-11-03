"""Intel Open Image Denoise, using the version bundled with Blender."""
import ctypes,os
from pathlib import Path
import numpy as np

_session=None

def denoise(rgb):
    global _session
    shared=Path(bpy_path())/'blender.shared'
    root_directory=os.add_dll_directory(str(shared.parent))
    directory=os.add_dll_directory(str(shared))
    cpu=ctypes.CDLL(str(shared/'OpenImageDenoise_device_cpu.dll'))
    dll=ctypes.CDLL(str(shared/'OpenImageDenoise.dll'))
    def bind(name,restype,args):
        fn=getattr(dll,name);fn.restype=restype;fn.argtypes=args;return fn
    ptr=ctypes.c_void_p;integer=ctypes.c_int;size=ctypes.c_size_t;string=ctypes.c_char_p
    if _session is None:
        device=bind('oidnNewDevice',ptr,[integer])(1);bind('oidnCommitDevice',None,[ptr])(device);_session=(dll,device,directory,root_directory,cpu)
    else:dll,device,directory,root_directory,cpu=_session
    filt=bind('oidnNewFilter',ptr,[ptr,string])(device,b'RT')
    source=np.ascontiguousarray(rgb,dtype=np.float32);output=np.empty_like(source)
    setimage=bind('oidnSetSharedFilterImage',None,[ptr,string,ptr,integer,size,size,size,size,size])
    height,width=source.shape[:2]
    for name,image in [(b'color',source),(b'output',output)]:setimage(filt,name,image.ctypes.data,3,width,height,0,12,width*12)
    bind('oidnSetFilterBool',None,[ptr,string,ctypes.c_bool])(filt,b'hdr',True)
    bind('oidnCommitFilter',None,[ptr])(filt);bind('oidnExecuteFilter',None,[ptr])(filt)
    message=ctypes.c_char_p();error=bind('oidnGetDeviceError',integer,[ptr,ctypes.POINTER(string)])(device,ctypes.byref(message))
    if error:raise RuntimeError(message.value)
    bind('oidnReleaseFilter',None,[ptr])(filt)
    return output

def bpy_path():
    try:
        import bpy
        return str(Path(bpy.app.binary_path).parent)
    except ModuleNotFoundError:
        return os.environ.get('BLENDER_HOME','C:/Program Files/Blender Foundation/Blender 5.2')
