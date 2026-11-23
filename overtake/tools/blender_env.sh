# Blender 4.2.0 runs in this sandbox as the `bpy` PyPI module. The sandbox has no
# X11/GL system libraries and no package manager access, so source this file to
# put the no-op stubs (built by tools/build_blender_stubs.py) on the loader path.
export LD_LIBRARY_PATH="/home/user/Spotify/.blender-stubs${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
