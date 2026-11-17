"""
Gera o modelo 3D do campus UNDB (Renascença, São Luís-MA) no Blender.

Fonte única: os contornos e pavimentos de src/lib/campus.ts (os mesmos do app),
traçados sobre o satélite Esri (public/campus/satelite.jpg, 0,1491 m/px).
Só entram os prédios da UNDB e a garagem; o Colégio Dom Bosco fica de fora.

Visual tirado das fotos do passeio (public/streetview/fotos) e do Street View
(mai/2024) em volta do quarteirão: paredes brancas, faixas de vidro verde-água,
lajes aparentes; na entrada, pórtico vermelho, rampa coberta com pilares
vermelhos e cubo vermelho vazado; térreo do Prédio Sul com pilares vermelhos e
letreiro "CENTRO UNIVERSITÁRIO"; na esquina da Av. do Vale, as Clínicas
Integradas da Saúde (4 pavimentos, pele de vidro, parte do Prédio Oeste).

Uso (Blender 4.2+):
  blender -b -P docs/blender/gera_campus.py -- <repo> [--render]

Saídas:
  docs/blender/campus-undb.blend   arquivo editável
  public/campus/campus-undb.glb    para o app (Three/R3F)
  docs/blender/preview.png         com --render

Coordenadas: metros, origem no centro da imagem (px 800, 590).
Blender: +X leste, +Y norte, +Z para cima. No glTF (Y para cima) isso vira
x = (px-800)*0.1491 e z = (py-590)*0.1491, o mesmo eixo do CampusScene:
basta escalar o modelo por M = 1/(100*0.1491) para cair em cima do satélite.
"""

import json
import math
import os
import random
import re
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
REPO = os.path.abspath(argv[0] if argv else ".")
RENDER = "--render" in argv

MPP = 0.1491  # metros por pixel
IMG_W, IMG_H = 1600, 1180
FLOOR_H = 3.8  # pé-direito (m), igual ao app
PARAPET = 1.0


def P(x, y):
    """pixel da imagem → metros (Blender XY)"""
    return Vector(((x - IMG_W / 2) * MPP, -(y - IMG_H / 2) * MPP))


# ------------------------------------------------------------- campus.ts

def read_campus():
    src = open(os.path.join(REPO, "src/lib/campus.ts"), encoding="utf-8").read()
    blds = src[src.index("export const BUILDINGS") : src.index("export const AREAS")]
    out = []
    for blk in re.split(r"\n  \{", blds)[1:]:
        g = lambda k, pat=r'"([^"]*)"': re.search(rf"\b{k}: {pat}", blk).group(1)
        out.append(
            dict(
                id=g("id"),
                name=g("name"),
                color=g("color"),
                floors=int(g("floors", r"(\d+)")),
                poly=json.loads(g("poly", r"(\[\[.*?\]\])")),
            )
        )
    areas = []
    a_src = src[src.index("export const AREAS") : src.index("/** Posição editável")]
    for m in re.finditer(r'id: "([^"]+)", name: "([^"]+)", kind: "(\w+)", poly: (\[\[.*?\]\])', a_src):
        areas.append(dict(id=m[1], name=m[2], kind=m[3], poly=json.loads(m[4])))
    gate = re.search(r"gate: \{ x: (\d+), y: (\d+) \}", src)
    return out, areas, (int(gate[1]), int(gate[2]))


# ------------------------------------------------------------- materiais

def hex_rgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]


def mat(name, color, rough=0.8, metal=0.0, alpha=1.0, emit=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hex_rgb(color) if isinstance(color, str) else color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    if emit:
        b.inputs["Emission Color"].default_value = hex_rgb(emit)
        b.inputs["Emission Strength"].default_value = 1.5
    return m


# ------------------------------------------------------------- geometria

def ccw(pts):
    a = sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))
    return pts if a > 0 else pts[::-1]


def inside(pts, q):
    c = False
    for i in range(len(pts)):
        a, b = pts[i], pts[i - 1]
        if (a.y > q.y) != (b.y > q.y) and q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x:
            c = not c
    return c


class Builder:
    """Acumula geometria num bmesh, com índice de material por face."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def prism(self, pts, z0, z1, m_side, m_top=None, m_bottom=None):
        v0 = [self.bm.verts.new((p.x, p.y, z0)) for p in pts]
        v1 = [self.bm.verts.new((p.x, p.y, z1)) for p in pts]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((v0[i], v0[j], v1[j], v1[i])).material_index = self.mi(m_side)
        self.bm.faces.new(v1).material_index = self.mi(m_top or m_side)
        if m_bottom is not False:
            self.bm.faces.new(v0[::-1]).material_index = self.mi(m_bottom or m_side)

    def box(self, a, t, n, s0, s1, d0, d1, z0, z1, m):
        """caixa alinhada à aresta: t ao longo, n para fora"""
        q = [a + t * s0 + n * d0, a + t * s1 + n * d0, a + t * s1 + n * d1, a + t * s0 + n * d1]
        self.prism(q, z0, z1, m)

    def add_mesh(self, me, xf, m):
        """copia um mesh (ex.: texto convertido) aplicando xf(co) -> Vector 3D"""
        vs = [self.bm.verts.new(xf(v.co)) for v in me.vertices]
        k = self.mi(m)
        for poly in me.polygons:
            try:
                self.bm.faces.new([vs[i] for i in poly.vertices]).material_index = k
            except ValueError:
                pass

    def text(self, body, at, n, z, size, depth, m, off=0.0):
        """letreiro em relevo na fachada: `at` = centro (XY), n = normal para fora"""
        cu = bpy.data.curves.new("txt", "FONT")
        cu.body = body
        cu.size = size
        cu.extrude = depth / 2
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        ob = bpy.data.objects.new("txt", cu)
        bpy.context.scene.collection.objects.link(ob)
        me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        r = Vector((-n.y, n.x))  # direita de quem olha a fachada de fora
        self.add_mesh(
            me,
            lambda c: Vector((at.x + r.x * c.x + n.x * (c.z + depth / 2 + off), at.y + r.y * c.x + n.y * (c.z + depth / 2 + off), z + c.y)),
            m,
        )
        ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)

    def holed_cube(self, c, half, z0, z1, radius, m, m_hole=None, seg=32):
        """cubo (eixos X/Y) vazado por um furo redondo no eixo Y, como o da entrada"""
        zc = (z0 + z1) / 2
        hz = (z1 - z0) / 2
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ca, sa = math.cos(a), math.sin(a)
            q = 1 / max(abs(ca), abs(sa))
            ring.append(((ca * radius, sa * radius), (ca * q * half, sa * q * hz)))
        for sgn in (-1, 1):
            y = c.y + sgn * half
            inner = [self.bm.verts.new((c.x + i[0], y, zc + i[1])) for i, _ in ring]
            outer = [self.bm.verts.new((c.x + o[0], y, zc + o[1])) for _, o in ring]
            for k in range(seg):
                j = (k + 1) % seg
                f = (inner[k], outer[k], outer[j], inner[j])
                self.bm.faces.new(f if sgn > 0 else f[::-1]).material_index = self.mi(m)
            if sgn < 0:
                front_in, front_out = inner, outer
            else:
                back_in, back_out = inner, outer
        for k in range(seg):
            j = (k + 1) % seg
            self.bm.faces.new((front_in[k], front_in[j], back_in[j], back_in[k])).material_index = self.mi(m_hole or m)
            self.bm.faces.new((front_out[k], back_out[k], back_out[j], front_out[j])).material_index = self.mi(m)

    def to_object(self, name, parent=None):
        me = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        return ob


def building(b, M, parent):
    pts = ccw([P(*p) for p in b["poly"]])
    h = b["floors"] * FLOOR_H
    accent = mat(f"Faixa_{b['id']}", b["color"], rough=0.5)
    bd = Builder()

    # corpo, cobertura e platibanda com faixa na cor do prédio
    bd.prism(pts, 0, h, M["parede"], M["laje"], False)
    rnd = random.Random(b["id"])
    n = len(pts)
    for i in range(n):
        a, c = pts[i], pts[(i + 1) % n]
        L = (c - a).length
        t = (c - a) / L
        nrm = Vector((t.y, -t.x))
        bd.box(a, t, nrm, 0, L, -0.3, 0.05, h, h + PARAPET - 0.6, M["parede"])
        bd.box(a, t, nrm, 0, L, -0.3, 0.08, h + PARAPET - 0.6, h + PARAPET, accent)
        # rodapé cinza
        bd.box(a, t, nrm, 0, L, 0, 0.04, 0, 0.6, M["rodape"])
        for f in range(b["floors"]):
            z = f * FLOOR_H
            if f:  # laje aparente entre pavimentos
                bd.box(a, t, nrm, 0, L, 0, 0.35, z - 0.2, z + 0.15, M["parede"])
            if L < 5:
                continue
            # faixa de janelas com montantes a cada ~1,8 m
            inset = 1.2
            z0, z1 = z + 1.0, z + (2.9 if f else 3.1)
            bd.box(a, t, nrm, inset, L - inset, 0.0, 0.06, z0, z1, M["vidro"])
            k = max(1, round((L - 2 * inset) / 1.8))
            for j in range(k + 1):
                s = inset + j * (L - 2 * inset) / k
                bd.box(a, t, nrm, s - 0.06, s + 0.06, 0.0, 0.14, z0, z1, M["caixilho"])
            bd.box(a, t, nrm, inset - 0.1, L - inset + 0.1, 0.0, 0.25, z0 - 0.12, z0, M["parede"])

    # condensadoras / caixas d'água na cobertura
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    placed, tries = 0, 0
    want = max(3, int(abs(sum(pts[i].x * pts[i - 1].y - pts[i - 1].x * pts[i].y for i in range(n))) / 2 / 250))
    while placed < want and tries < 400:
        tries += 1
        q = Vector((rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))))
        ok = all(inside(pts, q + Vector(d)) for d in ((3, 3), (-3, 3), (3, -3), (-3, -3)))
        if not ok:
            continue
        w, d = rnd.choice([(1.4, 0.8), (1.2, 1.2), (2.4, 1.0)])
        s = [q + Vector(v) for v in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
        bd.prism(s, h, h + rnd.uniform(0.8, 1.4), M["equip"], m_bottom=False)
        placed += 1
    if b["floors"] >= 2:  # caixa d'água / casa de máquinas
        c = sum(pts, Vector((0, 0))) / n
        if inside(pts, c):
            s = [c + Vector(v) for v in ((-2.5, -2), (2.5, -2), (2.5, 2), (-2.5, 2))]
            bd.prism(s, h, h + 3.0, M["parede"], M["laje"], False)

    if b["id"] == "sul":
        fachada_sul(bd, pts, h, M)
    if b["id"] == "oeste":
        clinicas(bd, M)

    ob = bd.to_object(f"Predio_{b['id']}", parent)
    ob["building_id"] = b["id"]
    ob["nome"] = b["name"]
    ob["pavimentos"] = b["floors"]
    ob["altura_m"] = round(h, 2)
    return ob


def fachada_sul(bd, pts, h, M):
    """Fachada para a avenida (Street View, 443 R. dos Azulões): térreo recuado
    com pilares vermelhos e o letreiro CENTRO UNIVERSITÁRIO no topo."""
    n = len(pts)
    # aresta mais ao sul (menor Y no Blender)
    i = min(range(n), key=lambda k: pts[k].y + pts[(k + 1) % n].y)
    a, c = pts[i], pts[(i + 1) % n]
    L = (c - a).length
    t = (c - a) / L
    nrm = Vector((t.y, -t.x))
    k = max(2, round(L / 4.5))
    for j in range(k + 1):
        s = 0.4 + j * (L - 0.8) / k
        bd.box(a, t, nrm, s - 0.3, s + 0.3, 0.4, 1.0, 0, FLOOR_H - 0.2, M["vermelho"])
    # marquise sobre a galeria do térreo
    bd.box(a, t, nrm, 0, L, 0, 1.3, FLOOR_H - 0.2, FLOOR_H + 0.15, M["parede"])
    mid = a + t * (L / 2)
    bd.text("CENTRO UNIVERSITÁRIO", mid, nrm, h - 0.35, 1.05, 0.12, M["letreiro"], off=0.02)


def clinicas(bd, M):
    """Clínicas Integradas da Saúde · Edifício Prof. Luiz Pinho Rodrigues:
    caixa de vidro de 4 pavimentos com moldura cinza, na esquina Av. do Vale."""
    floors, H = 4, 4 * FLOOR_H
    x0, x1, y0, y1 = 113.5, 230.0, 926.0, 1069.5
    pts = ccw([P(x0, y1), P(x1, y1), P(x1, y0), P(x0, y0)])
    bd.prism(pts, 0, H, M["moldura"], M["laje"], False)
    nn = len(pts)
    for i in range(nn):
        a, c = pts[i], pts[(i + 1) % nn]
        L = (c - a).length
        t = (c - a) / L
        nrm = Vector((t.y, -t.x))
        bd.box(a, t, nrm, 0, L, -0.3, 0.25, H, H + 0.9, M["moldura"])  # platibanda
        south = nrm.y < -0.5
        g0 = 6.0 if south else 0.6  # na fachada sul, o painel cinza do letreiro
        bd.box(a, t, nrm, g0, L - 0.6, 0.0, 0.08, 0.6, H - 0.4, M["vidro_clin"])
        k = max(1, round((L - 0.6 - g0) / 1.6))
        for j in range(k + 1):
            s = g0 + j * (L - 0.6 - g0) / k
            bd.box(a, t, nrm, s - 0.05, s + 0.05, 0.0, 0.16, 0.6, H - 0.4, M["moldura"])
        for f in range(1, floors):
            bd.box(a, t, nrm, g0, L - 0.6, 0.0, 0.18, f * FLOOR_H - 0.12, f * FLOOR_H + 0.12, M["moldura"])
        if south:
            bd.box(a, t, nrm, 0.0, 5.6, 0.0, 0.3, 0.0, H + 0.9, M["moldura"])
            bd.text("UNDB", a + t * 2.8, nrm, H - 2.0, 1.25, 0.1, M["letreiro_claro"], off=0.3)
            bd.text("CLÍNICAS", a + t * 2.8, nrm, H - 4.0, 0.62, 0.06, M["letreiro_claro"], off=0.3)
            bd.text("INTEGRADAS", a + t * 2.8, nrm, H - 4.8, 0.62, 0.06, M["letreiro_claro"], off=0.3)
    # embasamento com rampa/guarda-corpo (térreo um pouco elevado)
    bd.prism(ccw([P(x0 - 4, y1 + 6), P(x1 + 2, y1 + 6), P(x1 + 2, y1), P(x0 - 4, y1)]), 0, 0.6, M["parede"], m_bottom=False)


def area(a, M, parent):
    pts = ccw([P(*p) for p in a["poly"]])
    bd = Builder()
    h = 3.2
    bd.prism(pts, 0, h, M["parede"], M["telha"], False)
    n = len(pts)
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        L = (p1 - p0).length
        t = (p1 - p0) / L
        bd.box(p0, t, Vector((t.y, -t.x)), 0, L, 0, 0.04, 0, 0.6, M["rodape"])
    ob = bd.to_object(f"Area_{a['id']}", parent)
    ob["area_id"] = a["id"]
    ob["nome"] = a["name"]
    return ob


def portal(gate, M, parent):
    """Entrada principal (Street View, 443 R. dos Azulões): pórtico vermelho
    largo, rampa coberta com pilares vermelhos até o Prédio Sul e o cubo
    vermelho vazado ao lado. Posições tiradas do satélite."""
    bd = Builder()
    red, slab = M["vermelho"], M["parede"]
    X = Vector((1, 0))
    Y = Vector((0, 1))
    # rampa coberta: x 1150–1192 px, da calçada (y 684) até o Sul (y 572)
    xa, xb, ya, yb = 1150, 1192, 684, 572
    w = (xb - xa) * MPP
    o = P(xa, ya)
    run = (ya - yb) * MPP
    bd.box(o, Y, X, 0, run, 0, w, 3.7, 4.0, slab)  # laje da cobertura
    bd.box(o, Y, X, 0, run, -0.15, 0.15, 3.55, 4.15, red)  # testeiras vermelhas
    bd.box(o, Y, X, 0, run, w - 0.15, w + 0.15, 3.55, 4.15, red)
    k = max(2, round(run / 3.2))
    for j in range(k + 1):
        s = 0.3 + j * (run - 0.6) / k
        for d in (0.15, w - 0.15):
            bd.box(o, Y, X, s - 0.2, s + 0.2, d - 0.2, d + 0.2, 0, 3.7, red)
    bd.box(o, Y, X, 0, run, 0.6, w - 0.6, 0, 0.12, M["rodape"])  # piso da rampa
    # pórtico: moldura em U, x 1136–1206 px, na frente da rampa
    po = P(1136, 692)
    pw = (1206 - 1136) * MPP
    pd = 2.8
    bd.box(po, Y, X, 0, pd, 0, 0.8, 0, 4.8, red)
    bd.box(po, Y, X, 0, pd, pw - 0.8, pw, 0, 4.8, red)
    bd.box(po, Y, X, 0, pd, 0.8, pw - 0.8, 4.0, 4.8, red)
    # cubo vermelho vazado (furo voltado para a avenida)
    bd.holed_cube(P(1120, 662), 1.8, 0, 3.6, 1.0, red, M["rodape"])
    ob = bd.to_object("Portao_Entrada", parent)
    ob["nome"] = "Entrada principal · pórtico e rampa coberta"
    return ob


def ground(parent):
    w, h = IMG_W * MPP, IMG_H * MPP
    me = bpy.data.meshes.new("Chao_Satelite")
    me.from_pydata([(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for li, (u, v) in zip(range(4), ((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[li].uv = (u, v)
    m = bpy.data.materials.new("Satelite")
    m.use_nodes = True
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(REPO, "public/campus/satelite.jpg"))
    tex.image.pack()
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 1
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    me.materials.append(m)
    ob = bpy.data.objects.new("Chao_Satelite", me)
    ob.location.z = -0.02
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    return ob


# ------------------------------------------------------------- main

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"

    M = {
        "parede": mat("Parede_Branca", "#E9E8E3", 0.85),
        "rodape": mat("Rodape_Cinza", "#7D7C78", 0.9),
        "laje": mat("Cobertura_Laje", "#8E8B84", 0.95),
        "telha": mat("Telha_Metalica", "#B9BBB8", 0.5, 0.6),
        "vidro": mat("Vidro", "#3F7A78", 0.08, 0.3),
        "vidro_clin": mat("Vidro_Clinica", "#5F7F92", 0.05, 0.5),
        "moldura": mat("Moldura_Cinza", "#8E9091", 0.6),
        "vermelho": mat("UNDB_Vermelho", "#D3122E", 0.45),
        "letreiro": mat("Letreiro", "#5A5E63", 0.35, 0.6),
        "letreiro_claro": mat("Letreiro_Claro", "#F4F4F2", 0.5),
        "caixilho": mat("Caixilho", "#3B3F44", 0.4, 0.7),
        "equip": mat("Equipamentos", "#CFCFC9", 0.6, 0.3),
    }

    root = bpy.data.objects.new("UNDB_Campus", None)
    scene.collection.objects.link(root)
    root["fonte"] = "src/lib/campus.ts + satélite Esri; ilustrativo onde a UNDB não publica"
    root["metros_por_pixel"] = MPP

    blds, areas, gate = read_campus()
    chao = ground(root)
    for b in blds:
        building(b, M, root)
    for a in areas:
        if a["kind"] != "fora":  # só domínio UNDB
            area(a, M, root)
    portal(gate, M, root)

    out_blend = os.path.join(REPO, "docs/blender/campus-undb.blend")
    out_glb = os.path.join(REPO, "public/campus/campus-undb.glb")

    if RENDER:
        setup_render(scene)

    bpy.ops.wm.save_as_mainfile(filepath=out_blend, compress=True)
    # o app já carrega o satélite (dia/noite): o chão fica só no .blend,
    # para o .glb não baixar a mesma imagem de novo no celular
    for ob in scene.objects:
        ob.select_set(ob is not chao)
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format="GLB",
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        use_selection=True,
    )
    print("OK", [b["id"] for b in blds], out_glb)

    if RENDER:
        scene.render.filepath = os.path.join(REPO, "docs/blender/preview.png")
        bpy.ops.render.render(write_still=True)


def setup_render(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
    world = bpy.data.worlds.new("Ceu")
    world.use_nodes = True
    sky = world.node_tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_elevation = math.radians(55)
    sky.sun_rotation = math.radians(210)
    world.node_tree.links.new(sky.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    scene.world = world
    sun = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", "SUN"))
    sun.data.energy = 4
    sun.data.angle = math.radians(2)
    sun.rotation_euler = (math.radians(35), math.radians(10), math.radians(210))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    cam.data.lens = 32
    scene.collection.objects.link(cam)
    cam.location = (95, -150, 120)
    target = Vector((-5, 15, 0))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -1.0


main()
