"""로우폴리 가구 스타일 PoC 생성기 (기획서 §11 아트 방향 · §17 출처 대장).

하는 일
  1. palette.json → 색상표 아틀라스 PNG 1장 (T_Palette.png)
  2. Design/Sheets/furniture_poc.csv의 가구를 부품 정의로 생성 (태그 변형 = UV가 가리키는 색 칸만 다름)
  3. 모델마다 FBX 내보내기 (피벗 = 바닥 중앙, 1 unit = 1 m, 앞면 = -Y)
  4. 미리보기 렌더 (태그별 방 디오라마, 가구 라인업)
  5. 출처 대장(Design/Sheets/asset_ledger.csv)에 행 기록

실행
  blender -b -P Tools/Blender/build_poc.py -- [--samples 64] [--scale 100] [--no-render]
  또는 bpy 모듈이 설치된 Python 3.11: python Tools/Blender/build_poc.py -- ...
"""
import argparse
import csv
import datetime
import json
import math
import os
import struct
import sys
import time
import zlib

import bpy  # bpy 모듈 환경에서는 bmesh보다 먼저 불러와야 함
import bmesh
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=os.path.join(ROOT, "Assets/_Project/Art/Generated/PoC"))
    p.add_argument("--preview", default=os.path.join(ROOT, "docs/previews/poc"))
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--scale", type=int, default=100, help="렌더 해상도 %%")
    p.add_argument("--no-render", action="store_true")
    return p.parse_args(argv)


# ---------------------------------------------------------------- 색상표

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def srgb_to_linear(h):
    def f(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(f(c) for c in hex_rgb(h))


class Palette:
    def __init__(self, path):
        with open(path, encoding="utf-8") as fp:
            d = json.load(fp)
        self.cols, self.rows, self.px = d["cols"], d["rows"], d["cell_px"]
        self.empty = hex_rgb(d["empty"])
        self.groups = d["groups"]
        self.cells = {}
        for g, gd in self.groups.items():
            for col, slot in enumerate(gd["colors"]):
                self.cells[(g, slot)] = (col, gd["row"])

    def uv(self, group, slot):
        col, row = self.cells[(group, slot)]
        return ((col + 0.5) / self.cols, 1.0 - (row + 0.5) / self.rows)

    def write_png(self, path):
        w, h = self.cols * self.px, self.rows * self.px
        grid = [[self.empty] * self.cols for _ in range(self.rows)]
        for gd in self.groups.values():
            for col, hx in enumerate(gd["colors"].values()):
                grid[gd["row"]][col] = hex_rgb(hx)
        lines = []
        for y in range(h):
            row = grid[y // self.px]
            lines.append(b"\x00" + b"".join(bytes(row[x // self.px]) for x in range(w)))

        def chunk(tag, data):
            return (struct.pack(">I", len(data)) + tag + data
                    + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

        png = (b"\x89PNG\r\n\x1a\n"
               + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
               + chunk(b"IDAT", zlib.compress(b"".join(lines), 9))
               + chunk(b"IEND", b""))
        with open(path, "wb") as fp:
            fp.write(png)


# ---------------------------------------------------------------- 부품 정의 (미터, 피벗 = 바닥 중앙, 앞면 = -Y)

def B(cx, cy, z0, sx, sy, sz, slot, bev=0.012, top=None, cut=()):
    """상자. (cx, cy) 중심, z0 바닥 높이."""
    return dict(kind="box", c=(cx, cy, z0 + sz / 2), s=(sx, sy, sz), slot=slot, bev=bev, top=top, cut=cut)


def BX(x0, x1, y0, y1, z0, z1, slot, **kw):
    """상자를 최소·최대 좌표로."""
    return B((x0 + x1) / 2, (y0 + y1) / 2, z0, x1 - x0, y1 - y0, z1 - z0, slot, **kw)


def C(cx, cy, z0, h, r1, r2, slot, seg=8):
    """원기둥·원뿔대. r1 = 아래 반지름, r2 = 위 반지름."""
    return dict(kind="cyl", c=(cx, cy, z0 + h / 2), h=h, r1=r1, r2=r2, slot=slot, seg=seg)


def S(cx, cy, cz, r, slot):
    """구 (아이코스피어 1단계)."""
    return dict(kind="ico", c=(cx, cy, cz), r=r, slot=slot)


def four(xh, yh):
    return [(sx * xh, sy * yh) for sx in (-1, 1) for sy in (-1, 1)]


def bed_double():
    W, L = 1.5, 2.0
    fx, fy = W / 2 + 0.03, L / 2 + 0.03
    p = [B(x, y, 0, 0.07, 0.07, 0.12, "wood_dark", 0.008) for x, y in four(fx - 0.05, fy - 0.05)]
    p += [
        B(0, 0, 0.12, W + 0.06, L + 0.06, 0.18, "wood"),                      # 프레임
        B(0, fy + 0.04, 0, W + 0.1, 0.08, 1.0, "wood"),                        # 헤드보드
        B(0, 0, 0.30, W, L, 0.18, "linen", 0.02),                             # 매트리스
        BX(-W / 2 - 0.02, W / 2 + 0.02, -L / 2 - 0.01, 0.41, 0.30, 0.50, "fabric_accent", bev=0.02),  # 이불
        BX(-W / 2 - 0.03, W / 2 + 0.03, 0.23, 0.41, 0.30, 0.515, "fabric", bev=0.02),                 # 이불 접힌 단
    ]
    p += [B(sx * 0.36, 0.76, 0.48, 0.6, 0.34, 0.12, "fabric", 0.04) for sx in (-1, 1)]  # 베개
    return p


def desk_basic():
    W, D, H = 1.0, 0.55, 0.75
    p = [B(0, 0, H - 0.04, W, D, 0.04, "wood", 0.008)]
    p += [B(x, y, 0, 0.045, 0.045, H - 0.04, "wood_dark", 0.006) for x, y in four(W / 2 - 0.05, D / 2 - 0.05)]
    p += [
        B(W / 2 - 0.27, 0, H - 0.18, 0.4, D - 0.06, 0.14, "wood", 0.008),             # 서랍
        B(W / 2 - 0.27, -(D - 0.06) / 2 - 0.01, H - 0.12, 0.12, 0.02, 0.02, "metal", 0.004),  # 손잡이
        B(0, D / 2 - 0.05, 0.18, W - 0.1, 0.02, 0.06, "wood_dark", 0.004),             # 뒤 가로대
    ]
    return p


def wardrobe_2door():
    W, D, H = 1.0, 0.55, 1.9
    dw = (W - 0.05) / 2
    p = [
        B(0, 0, 0, W - 0.04, D - 0.04, 0.08, "wood_dark", 0.006),   # 받침
        B(0, 0, 0.08, W, D, H - 0.08, "wood", 0.01),                # 몸통
        B(0, 0, H, W + 0.04, D + 0.04, 0.04, "wood_dark", 0.006),   # 상판 몰딩
    ]
    for sx in (-1, 1):
        p.append(B(sx * (dw / 2 + 0.0075), -D / 2 - 0.006, 0.12, dw, 0.018, H - 0.16, "wood", 0.006))  # 문
        p.append(B(sx * 0.05, -D / 2 - 0.025, H * 0.5, 0.025, 0.02, 0.22, "metal", 0.004))          # 손잡이
    return p


def lamp_floor():
    return [
        C(0, 0, 0, 0.03, 0.17, 0.17, "metal", 12),     # 받침
        C(0, 0, 0.03, 1.3, 0.015, 0.015, "metal", 6),  # 기둥
        S(0, 0, 1.27, 0.045, "bulb"),                  # 전구
        C(0, 0, 1.28, 0.28, 0.21, 0.13, "shade", 10),  # 갓
    ]


def chair_basic():
    W, H = 0.42, 0.45
    p = [B(x, y, 0, 0.035, 0.035, H - 0.04, "wood_dark", 0.005) for x, y in four(W / 2 - 0.03, W / 2 - 0.03)]
    p += [
        B(0, 0, H - 0.04, W, W, 0.04, "wood", 0.006),                    # 좌판
        B(0, -0.01, H, W - 0.05, W - 0.07, 0.04, "fabric_accent", 0.012),  # 방석
        B(0, W / 2 - 0.03, H + 0.26, W, 0.03, 0.14, "wood", 0.006),      # 등받이
    ]
    p += [B(sx * (W / 2 - 0.03), W / 2 - 0.03, H, 0.035, 0.035, 0.42, "wood_dark", 0.005) for sx in (-1, 1)]
    return p


def shell_room_m():
    """M 크기 방 껍데기 3.6 x 3.6 m. 뒤쪽 두 벽(북·서)만 있는 디오라마 단면."""
    X, Y, T, H = 1.8, 1.8, 0.12, 2.4
    wx0, wx1, wz0, wz1 = -1.1, -0.35, 0.9, 1.95   # 북쪽 창
    wall = dict(bev=0, top="slab")
    fy = Y + T / 2
    p = [
        BX(-X - T, X, -Y, Y + T, -0.2, -0.01, "slab", bev=0),               # 바닥 슬래브 (단면)
        BX(-X, X, -Y, Y, -0.01, 0.0, "floor", bev=0),                       # 장판
        BX(-X - T, -X, -Y, Y + T, 0, H, "wallpaper", cut=[((0, -1, 0), "slab")], **wall),  # 서쪽 벽
        BX(-X, wx0, Y, Y + T, 0, H, "wallpaper", **wall),                   # 북쪽 벽: 창 왼쪽
        BX(wx1, X, Y, Y + T, 0, H, "wallpaper", cut=[((1, 0, 0), "slab")], **wall),  # 창 오른쪽
        BX(wx0, wx1, Y, Y + T, 0, wz0, "wallpaper", **wall),                # 창 아래
        BX(wx0, wx1, Y, Y + T, wz1, H, "wallpaper", **wall),                # 창 위
        BX(wx0, wx1, fy - 0.005, fy + 0.005, wz0, wz1, "glass", bev=0),     # 유리
        BX(-X, -X + 0.015, -Y, Y, 0, 0.07, "baseboard", bev=0),             # 걸레받이
        BX(-X, X, Y - 0.015, Y, 0, 0.07, "baseboard", bev=0),
        BX(wx0 - 0.05, wx1 + 0.05, Y - 0.06, Y, wz0 - 0.04, wz0, "frame", bev=0.005),  # 창턱
    ]
    f = 0.05
    for x0, x1, z0, z1 in [(wx0, wx0 + f, wz0, wz1), (wx1 - f, wx1, wz0, wz1),
                           (wx0, wx1, wz0, wz0 + f), (wx0, wx1, wz1 - f, wz1),
                           ((wx0 + wx1) / 2 - f / 2, (wx0 + wx1) / 2 + f / 2, wz0, wz1)]:
        p.append(BX(x0, x1, fy - 0.03, fy + 0.03, z0, z1, "frame", bev=0.004))  # 창틀
    return p


BUILDERS = {
    "bed_double": bed_double,
    "desk_basic": desk_basic,
    "wardrobe_2door": wardrobe_2door,
    "lamp_floor": lamp_floor,
    "chair_basic": chair_basic,
    "shell_room_m": shell_room_m,
}


# ---------------------------------------------------------------- 메시 생성

def build_object(name, parts, group, pal, mat, coll):
    bm = bmesh.new()
    face_slot = {}
    for part in parts:
        before = set(bm.faces)
        k = part["kind"]
        if k == "box":
            m = Matrix.Translation(part["c"]) @ Matrix.Diagonal((*part["s"], 1.0))
            bmesh.ops.create_cube(bm, size=1.0, matrix=m)
            bev = min(part["bev"], 0.45 * min(part["s"])) if part["bev"] else 0.0
            if bev > 0:
                new = [f for f in bm.faces if f not in before]
                edges = list({e for f in new for e in f.edges})
                bmesh.ops.bevel(bm, geom=edges, offset=bev, segments=1, affect="EDGES", profile=0.5)
        elif k == "cyl":
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=part["seg"],
                                  radius1=part["r1"], radius2=part["r2"], depth=part["h"],
                                  matrix=Matrix.Translation(part["c"]))
        elif k == "ico":
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=part["r"],
                                       matrix=Matrix.Translation(part["c"]))
        for f in bm.faces:
            if f in before:
                continue
            f.normal_update()
            slot = part["slot"]
            if part.get("top") and f.normal.z > 0.9:
                slot = part["top"]
            for d, s in part.get("cut", ()):
                if f.normal.dot(Vector(d)) > 0.9:
                    slot = s
            face_slot[f] = slot

    uv_layer = bm.loops.layers.uv.new("UVMap")
    for f, slot in face_slot.items():
        uv = pal.uv(group, slot)
        for loop in f.loops:
            loop[uv_layer].uv = uv
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    verts = len(bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj, tris, verts


def new_material(name):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except (AttributeError, TypeError):
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    for key, val in (("Roughness", 0.75), ("Specular IOR Level", 0.25)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = val
    return mat, bsdf


def palette_material(img):
    mat, bsdf = new_material("M_Palette")
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def flat_material(name, hx):
    mat, bsdf = new_material(name)
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(hx), 1.0)
    return mat


# ---------------------------------------------------------------- 내보내기

def export_fbx(obj, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.fbx(
        filepath=path, use_selection=True, object_types={"MESH"},
        apply_scale_options="FBX_SCALE_ALL", bake_space_transform=True,
        axis_forward="-Z", axis_up="Y", use_mesh_modifiers=True,
        mesh_smooth_type="FACE", path_mode="RELATIVE", embed_textures=False)


def update_ledger(rows):
    path = os.path.join(ROOT, "Design/Sheets/asset_ledger.csv")
    fields = ["id", "path", "source_type", "tool", "plan", "license_ref", "commercial_ok",
              "credit_required", "human_work", "record_location", "owner", "reviewer", "created"]
    existing = []
    if os.path.exists(path):
        with open(path, encoding="utf-8", newline="") as fp:
            existing = list(csv.DictReader(fp))
    ids = {r["id"] for r in rows}
    merged = [r for r in existing if r["id"] not in ids] + rows
    with open(path, "w", encoding="utf-8", newline="") as fp:
        w = csv.DictWriter(fp, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(merged)


# ---------------------------------------------------------------- 렌더 장면

def setup_render(scene, samples, scale):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.render.resolution_percentage = scale
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"   # 색상표 색이 그대로 보이게
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.new("W_Preview")
    scene.world = world
    try:
        world.use_nodes = True
    except (AttributeError, TypeError):
        pass
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    light_bg = nt.nodes.new("ShaderNodeBackground")
    light_bg.inputs["Color"].default_value = (*srgb_to_linear("#e4f0f5"), 1)
    light_bg.inputs["Strength"].default_value = 0.9
    cam_bg = nt.nodes.new("ShaderNodeBackground")
    cam_bg.inputs["Color"].default_value = (*srgb_to_linear("#cfe6ee"), 1)
    cam_bg.inputs["Strength"].default_value = 1.0
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(light_bg.outputs["Background"], mix.inputs[1])
    nt.links.new(cam_bg.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])


def add_sun(coll):
    light = bpy.data.lights.new("Sun", "SUN")
    light.energy = 3.2
    light.angle = math.radians(10)
    light.color = srgb_to_linear("#fff1dc")
    obj = bpy.data.objects.new("Sun", light)
    coll.objects.link(obj)
    obj.rotation_euler = Vector((0.55, 0.7, -1.0)).normalized().to_track_quat("-Z", "Y").to_euler()
    return obj


def add_point(coll, loc, energy=25):
    light = bpy.data.lights.new("LampGlow", "POINT")
    light.energy = energy
    light.shadow_soft_size = 0.05
    light.color = srgb_to_linear("#ffd9a0")
    obj = bpy.data.objects.new("LampGlow", light)
    obj.location = loc
    coll.objects.link(obj)
    return obj


def add_camera(coll, name, target, azim, elev, dist, lens=None, ortho=None):
    cam = bpy.data.cameras.new(name)
    if ortho:
        cam.type = "ORTHO"
        cam.ortho_scale = ortho
    else:
        cam.lens = lens
    cam.clip_end = 300
    obj = bpy.data.objects.new(name, cam)
    coll.objects.link(obj)
    a, e = math.radians(azim), math.radians(elev)
    off = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    obj.location = Vector(target) + off
    obj.rotation_euler = (-off).to_track_quat("-Z", "Y").to_euler()
    return obj


def place(src, coll, loc, rot_z_deg=0.0):
    o = src.copy()
    coll.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, math.radians(rot_z_deg))
    return o


def add_label(coll, text, loc, mat):
    cu = bpy.data.curves.new(text, "FONT")
    cu.body = text
    cu.size = 0.32
    cu.extrude = 0.005
    cu.align_x = "LEFT"
    obj = bpy.data.objects.new("Label_" + text, cu)
    obj.location = loc
    obj.data.materials.append(mat)
    coll.objects.link(obj)
    return obj


def render(scene, cam, visible, path, res):
    for o in scene.objects:
        o.hide_render = o not in visible
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    return time.time() - t


# ---------------------------------------------------------------- 메인

ROOM_LAYOUT = {   # base: (x, y, 회전°) — M방 디오라마 배치. 북·서 벽 기준
    "bed_double": (0.55, 0.69, 0),
    "wardrobe_2door": (-1.5, 1.15, 90),
    "desk_basic": (-1.5, -0.95, 90),
    "chair_basic": (-1.0, -0.88, -90),
    "lamp_floor": (1.55, 1.5, 0),
}
LINEUP_ORDER = ["bed_double", "wardrobe_2door", "desk_basic", "chair_basic", "lamp_floor"]


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.preview, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    coll = scene.collection

    pal = Palette(os.path.join(HERE, "palette.json"))
    atlas_path = os.path.join(args.out, "T_Palette.png")
    pal.write_png(atlas_path)
    img = bpy.data.images.load(atlas_path)
    mat = palette_material(img)

    with open(os.path.join(ROOT, "Design/Sheets/furniture_poc.csv"), encoding="utf-8") as fp:
        specs = list(csv.DictReader(fp))
    specs.append({"id": "room_shell_m", "base": "shell_room_m", "tag": "shell", "slot_kind": "방 껍데기"})

    objs, report, ledger = {}, [], []
    today = datetime.date.today().isoformat()
    tool = f"Blender {bpy.app.version_string} (bpy) + Tools/Blender/build_poc.py"
    for s in specs:
        t = time.time()
        obj, tris, verts = build_object(s["id"], BUILDERS[s["base"]](), s["tag"], pal, mat, coll)
        dims = tuple(round(v, 2) for v in obj.dimensions)
        fbx = os.path.join(args.out, s["id"] + ".fbx")
        export_fbx(obj, fbx)
        objs[(s["base"], s["tag"])] = obj
        report.append(dict(id=s["id"], tris=tris, verts=verts, size_m=dims, ms=round((time.time() - t) * 1000)))
        ledger.append(dict(
            id=s["id"], path=os.path.relpath(fbx, ROOT).replace(os.sep, "/"),
            source_type="자체(절차 생성)", tool=tool, plan="무료",
            license_ref="https://www.blender.org/about/license/", commercial_ok="예",
            credit_required="아니오",
            human_work="형태·치수·색 지정은 기획서 §11 기준으로 AI가 작성, 사람 검수 대기",
            record_location="Tools/Blender/, Design/Sheets/furniture_poc.csv",
            owner="AI 에이전트", reviewer="", created=today))
    ledger.append(dict(
        id="tex_palette", path=os.path.relpath(atlas_path, ROOT).replace(os.sep, "/"),
        source_type="자체(절차 생성)", tool="Tools/Blender/build_poc.py + palette.json", plan="무료",
        license_ref="", commercial_ok="예", credit_required="아니오",
        human_work="색 값 지정, 사람 검수 대기", record_location="Tools/Blender/palette.json",
        owner="AI 에이전트", reviewer="", created=today))
    update_ledger(ledger)

    for r in report:
        print(f"[model] {r['id']:<30} tris={r['tris']:>4} verts={r['verts']:>4} size={r['size_m']} {r['ms']}ms")
    with open(os.path.join(args.out, "build_report.json"), "w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)

    if args.no_render:
        return

    # ---- 렌더
    setup_render(scene, args.samples, args.scale)
    sun = add_sun(coll)
    shell = objs[("shell_room_m", "shell")]
    room_cam = add_camera(coll, "CamRoom", (0.0, 0.2, 0.75), azim=45, elev=38, dist=12.5, lens=60)

    for tag in ("natural", "sea"):
        vis = {sun, room_cam, place(shell, coll, (0, 0, 0))}
        for base, (x, y, r) in ROOM_LAYOUT.items():
            vis.add(place(objs[(base, tag)], coll, (x, y, 0), r))
        vis.add(add_point(coll, (1.55, 1.5, 1.32)))
        sec = render(scene, room_cam, vis, os.path.join(args.preview, f"room_{tag}.png"), (1600, 1200))
        print(f"[render] room_{tag}.png {sec:.1f}s")

    ground = bpy.data.meshes.new("Ground")
    gbm = bmesh.new()
    bmesh.ops.create_grid(gbm, x_segments=1, y_segments=1, size=30)
    gbm.to_mesh(ground)
    gbm.free()
    ground.materials.append(flat_material("M_Ground", "#e6dccb"))
    gobj = bpy.data.objects.new("Ground", ground)
    coll.objects.link(gobj)
    label_mat = flat_material("M_Label", "#3a4a46")
    line_cam = add_camera(coll, "CamLineup", (-0.6, 0.2, 0.5), azim=28, elev=34, dist=30, ortho=12.5)
    vis = {sun, line_cam, gobj}
    widths = {"bed_double": 1.6, "wardrobe_2door": 1.04, "desk_basic": 1.0, "chair_basic": 0.42, "lamp_floor": 0.42}
    for tag, y, label in (("natural", 2.0, "NATURAL"), ("sea", -1.8, "SEA")):
        x = -3.4
        vis.add(add_label(coll, label, (-5.6, y - 0.15, 0.0), label_mat))
        for base in LINEUP_ORDER:
            w = widths[base]
            vis.add(place(objs[(base, tag)], coll, (x + w / 2, y, 0)))
            x += w + 0.6
    sec = render(scene, line_cam, vis, os.path.join(args.preview, "lineup.png"), (2000, 1100))
    print(f"[render] lineup.png {sec:.1f}s")


if __name__ == "__main__":
    main()
