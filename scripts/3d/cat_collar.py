"""Surface-fitted collar accessories sharing the body's deform weights."""
import math
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from cat_model import solid_material


class _SkinSurface:
    def __init__(self, mesh, arm):
        mesh.data.calc_loop_triangles()
        self.mesh = mesh
        self.arm = arm
        self.triangles = [tuple(triangle.vertices) for triangle in mesh.data.loop_triangles]
        self.tree = BVHTree.FromPolygons(
            [vertex.co.copy() for vertex in mesh.data.vertices], self.triangles,
            all_triangles=True)

    def sample(self, point):
        location, normal, triangle, _ = self.tree.find_nearest(point)
        indices = self.triangles[triangle]
        first, second, third = [self.mesh.data.vertices[index].co for index in indices]
        edge_a, edge_b, offset = second-first, third-first, location-first
        aa, ab, bb = edge_a.dot(edge_a), edge_a.dot(edge_b), edge_b.dot(edge_b)
        denominator = aa*bb-ab*ab
        weight_b = (bb*offset.dot(edge_a)-ab*offset.dot(edge_b))/denominator
        weight_c = (aa*offset.dot(edge_b)-ab*offset.dot(edge_a))/denominator
        barycentric = [max(0, weight) for weight in (1-weight_b-weight_c, weight_b, weight_c)]
        total = sum(barycentric)
        barycentric = [weight/total for weight in barycentric]
        smooth_normal = sum((self.mesh.data.vertices[index].normal*weight
                             for index, weight in zip(indices, barycentric)), Vector()).normalized()
        return location, smooth_normal, indices, barycentric

    def bind(self, name, vertices, faces, materials, slots=None):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        topology = bmesh.new()
        topology.from_mesh(data)
        bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
        topology.to_mesh(data)
        topology.free()
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        for material in materials:
            data.materials.append(material)
        for polygon in data.polygons:
            polygon.use_smooth = True
            polygon.material_index = slots[polygon.index] if slots else 0
        groups = {}
        for vertex in data.vertices:
            _, _, indices, barycentric = self.sample(vertex.co)
            weights = {}
            for index, factor in zip(indices, barycentric):
                for source in self.mesh.data.vertices[index].groups:
                    joint = self.mesh.vertex_groups[source.group].name
                    if joint in self.arm.data.bones:
                        weights[joint] = weights.get(joint, 0)+factor*source.weight
            strongest = sorted(weights.items(), key=lambda item: item[1], reverse=True)[:4]
            total = sum(weight for _, weight in strongest)
            for joint, weight in strongest:
                if weight <= 0:
                    continue
                if joint not in groups:
                    groups[joint] = obj.vertex_groups.new(name=joint)
                groups[joint].add([vertex.index], weight/total, 'REPLACE')
        obj.parent = self.arm
        obj.modifiers.new('Collar skin deformation', 'ARMATURE').object = self.arm
        return obj


def _loop(surface, center, gold):
    vertices, faces = [], []
    segments, sides = 16, 6
    for index in range(segments):
        angle = math.tau*index/segments
        radial = Vector((math.sin(angle), 0, math.cos(angle)))
        middle = center+Vector((.012*math.sin(angle), 0, .017*math.cos(angle)))
        for side in range(sides):
            around = math.tau*side/sides
            vertices.append(middle+.004*(radial*math.cos(around)+Vector((0, 1, 0))*math.sin(around)))
    for index in range(segments):
        for side in range(sides):
            faces.append((index*sides+side, ((index+1)%segments)*sides+side,
                          ((index+1)%segments)*sides+(side+1)%sides, index*sides+(side+1)%sides))
    return surface.bind('Collar bell loop', vertices, faces, [gold])


def _bell(surface, center, gold):
    shadow = solid_material('Bell recessed slot', '69421F', .65)
    latitudes = (.22, .46, .72, .98, 1.24, 1.49, 1.60, 1.82, 2.08, 2.36, 2.64, 2.90)
    segments = 24
    vertices = [center+Vector((0, 0, .036))]
    faces, slots = [], []
    for latitude in latitudes:
        for index in range(segments):
            angle = math.tau*index/segments
            recess = .0015 if latitude in (1.49, 1.60) and math.sin(angle) < -.45 else 0
            vertices.append(center+Vector(((.035-recess)*math.sin(latitude)*math.cos(angle),
                                           (.031-recess)*math.sin(latitude)*math.sin(angle),
                                           .036*math.cos(latitude))))
    bottom = len(vertices)
    vertices.append(center-Vector((0, 0, .036)))
    for index in range(segments):
        following = (index+1)%segments
        faces.append((0, 1+index, 1+following))
        slots.append(0)
        for row in range(len(latitudes)-1):
            start = 1+row*segments
            faces.append((start+index, start+segments+index, start+segments+following, start+following))
            slots.append(int(row == 5 and math.sin(math.tau*(index+.5)/segments) < -.5))
        start = 1+(len(latitudes)-1)*segments
        faces.append((bottom, start+following, start+index))
        slots.append(0)
    return surface.bind('Collar gold bell', vertices, faces, [gold, shadow], slots)


def add_collar(arm, mesh):
    """Return closed accessories, each vertex barycentrically bound to the skin."""
    surface = _SkinSurface(mesh, arm)
    red = solid_material('Red collar leather', 'C4473F', .56)
    gold = solid_material('Collar warm gold', 'E6AE51', .30)
    gold.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .35
    segments = 48
    axis = Vector((0, -.44, 1.02))
    plane_normal = Vector((0, -.30, 1)).normalized()
    centers = []
    for index in range(segments):
        angle = math.tau*index/segments
        direction = Vector((math.sin(angle), -math.cos(angle), -.30*math.cos(angle))).normalized()
        point, _, _, _ = surface.tree.ray_cast(axis, direction)
        if point is None:
            raise ValueError('Collar ray missed the neck skin')
        centers.append(point)
    # Wide and thick enough to stay a solid band, not a broken line, when the
    # whole cat is only about 150 px tall.
    section = ((-.030, 0), (.030, 0), (.038, .007), (.038, .018),
               (.030, .025), (-.030, .025), (-.038, .018), (-.038, .007))
    vertices, faces = [], []
    for index, center in enumerate(centers):
        _, normal, _, _ = surface.sample(center)
        tangent = (centers[(index+1)%segments]-centers[index-1]).normalized()
        across = normal.cross(tangent).normalized()
        if across.dot(plane_normal) < 0:
            across = -across
        for height, depth in section:
            point, normal, _, _ = surface.sample(center+across*height)
            vertices.append(point+normal*(.012+depth))
    for index in range(segments):
        for side in range(len(section)):
            following = (side+1)%len(section)
            faces.append((index*len(section)+side, ((index+1)%segments)*len(section)+side,
                          ((index+1)%segments)*len(section)+following, index*len(section)+following))
    band = surface.bind('Neck collar band', vertices, faces, [red])
    point, normal, _, _ = surface.sample(centers[-3])
    loop_center = point+normal*.024+Vector((0, -.030, -.005))
    return [band, _loop(surface, loop_center, gold),
            _bell(surface, loop_center+Vector((0, -.012, -.028)), gold)]
