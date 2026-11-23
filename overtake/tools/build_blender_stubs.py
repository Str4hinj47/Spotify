#!/usr/bin/env python3
"""Rebuild the no-op X11/GL stub libraries that let the `bpy` (Blender 4.2) wheel
load on a machine with no X11/Mesa packages and no package-manager access.

Blender's `__init__.so` and the bundled USD/MaterialX libraries link against
libXrender/libXfixes/libXi/libXxf86vm/libxkbcommon/libGL/libICE/libSM.  None of
those symbols are reached during headless import/render work (they belong to the
GHOST windowing layer), so empty definitions are enough to satisfy the loader.
libxkbcommon additionally needs a `V_0.5.0` version node or ld.so aborts.
"""
import os, subprocess, sys

OUT = "/home/user/Spotify/.blender-stubs"
GROUPS = {
    "libXi.so.6": ["XCloseDevice", "XFreeDeviceList", "XFreeDeviceState", "XGetExtensionVersion",
                   "XListInputDevices", "XOpenDevice", "XQueryDeviceState", "XSelectExtensionEvent",
                   "_XiGetDevicePresenceNotifyEvent"],
    "libXxf86vm.so.1": ["XF86VidModeGetAllModeLines", "XF86VidModeQueryVersion",
                        "XF86VidModeSetViewPort", "XF86VidModeSwitchToMode"],
    "libXfixes.so.3": ["XFixesHideCursor", "XFixesShowCursor"],
    "libxkbcommon.so.0": ["xkb_compose_state_feed", "xkb_compose_state_get_status",
                          "xkb_compose_state_get_utf8", "xkb_compose_state_new",
                          "xkb_compose_state_reset", "xkb_compose_state_unref",
                          "xkb_compose_table_new_from_locale", "xkb_compose_table_unref",
                          "xkb_context_new", "xkb_context_unref", "xkb_keymap_key_repeats",
                          "xkb_keymap_mod_get_index", "xkb_keymap_new_from_string",
                          "xkb_keymap_unref", "xkb_state_get_keymap", "xkb_state_key_get_one_sym",
                          "xkb_state_key_get_utf8", "xkb_state_new", "xkb_state_serialize_mods",
                          "xkb_state_unref", "xkb_state_update_mask"],
    "libGL.so.1": ["glFinish", "glXChooseFBConfig", "glXChooseVisual", "glXCreateContext",
                   "glXCreateGLXPixmap", "glXCreateNewContext", "glXCreatePbuffer",
                   "glXCreateWindow", "glXDestroyContext", "glXDestroyGLXPixmap",
                   "glXDestroyPbuffer", "glXGetClientString", "glXGetConfig", "glXGetCurrentContext",
                   "glXGetCurrentDisplay", "glXGetCurrentDrawable", "glXGetFBConfigs",
                   "glXGetVisualFromFBConfig", "glXIsDirect", "glXMakeContextCurrent",
                   "glXMakeCurrent", "glXQueryContext", "glXQueryExtension",
                   "glXQueryExtensionsString", "glXQueryVersion", "glXSwapBuffers",
                   "glXSwapIntervalEXT", "glXSwapIntervalSGI", "glXWaitGL", "glXWaitX",
                   "glXGetProcAddress", "glXGetProcAddressARB"],
    "libXrender.so.1": [], "libICE.so.6": [], "libSM.so.6": [],
}
VERSIONED = {"libxkbcommon.so.0": "V_0.5.0"}


def main():
    os.makedirs(OUT, exist_ok=True)
    for soname, syms in GROUPS.items():
        src = os.path.join(OUT, soname.replace(".", "_") + ".c")
        with open(src, "w") as fh:
            fh.write("".join(f"void {s}(void) {{}}\n" for s in syms))
            fh.write("int __bpy_stub_%s(void) { return 0; }\n" % soname.replace(".", "_"))
        cmd = ["gcc", "-shared", "-fPIC", "-O0", "-Wl,-soname,%s" % soname]
        if soname in VERSIONED:
            vmap = os.path.join(OUT, soname.replace(".", "_") + ".map")
            with open(vmap, "w") as fh:
                fh.write("%s {\n  global: *;\n  local: *;\n};\n" % VERSIONED[soname])
            cmd += ["-Wl,--version-script=%s" % vmap]
        cmd += ["-o", os.path.join(OUT, soname), src]
        subprocess.run(cmd, check=True)
        print("built", soname, "(%d symbols)" % len(syms))


if __name__ == "__main__":
    main()
