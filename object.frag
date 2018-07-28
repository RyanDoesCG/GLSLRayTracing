#version 450

#extension GL_ARB_separate_shader_objects : enable
#extension GL_ARB_shading_language_420pack : enable

/* * * * * * * * * * * * * * * * * * * * * * * * * * *
 *  Marcos
 * * * * * * * * * * * * * * * * * * * * * * * * * * */
// Rendering Macros
#define N_SAMPLES 100.0
#define N_BOUNCES 2
// Scene Macros
#define N_SPHERES 4
#define N_PLANES 4

/* * * * * * * * * * * * * * * * * * * * * * * * * * *
 *  Uniforms, Inputs and Outputs
 * * * * * * * * * * * * * * * * * * * * * * * * * * */
layout (binding = 0) uniform UniformBuffer {
    // Camera Data
    vec4 cameraPosition;
    vec4 cameraLook;
    // Sphere Scene Data
    vec4 materials [N_SPHERES];
    vec4 spheres   [N_SPHERES];
    // Plane Scene Data
    vec4 positions [N_PLANES];
    vec4 normals   [N_PLANES];
    // Colours without Lighting
    vec4 albedos   [N_SPHERES + 1];
    // Random Direction Buffer
    vec3 directions[512];
} ubo;
layout (location = 1) in vec2 uv;
layout (location = 0) out vec4 color;

/* * * * * * * * * * * * * * * * * * * * * * * * * * *
 *  Random Number Generation
 * * * * * * * * * * * * * * * * * * * * * * * * * * */
float randomScalar (vec2 seed)
	{ // randomScalar
    return -1.0 + ((abs(fract(sin(dot(seed.xy ,vec2(12.9898,78.233))) * 43758.5453))) * 2.0);
    } // randomScalar
int randomID = 0;
vec3 randomVector (vec3 normal)
    { // randomVector
    vec3 result;
    return normalize(ubo.directions[(randomID++) % 512]);
    } // randomVector

/* * * * * * * * * * * * * * * * * * * * * * * * * * *
 *  Geometric Intersection
 * * * * * * * * * * * * * * * * * * * * * * * * * * */
struct Intersection
    {  // Intersection
    float t;
    vec3  p;
    vec3  n;
    int  id;
    }; // Intersection

Intersection intersect (int sphereID, vec3 rayOrigin, vec3 rayDirection)
    { // sphere intersect
    Intersection hit;
    vec3  o = rayOrigin - ubo.spheres[sphereID].xyz;
    float a = dot (rayDirection, rayDirection);
    float b = 2.0 * dot (o, rayDirection);
    float c = dot (o, o) - ubo.spheres[sphereID].w * ubo.spheres[sphereID].w;
    float d = b * b - 4 * a * c;
    float t = 0.0;
    if (d > 0.0)
        { // hit found
        t = (-b - sqrt(d)) / (2.0 * a);
        if (t > 0.0 && t < 1000.0)
            { // hit found at low root
            hit.t = t;
            hit.p = rayOrigin + (normalize(rayDirection) * t);
            hit.n = -normalize (ubo.spheres[sphereID].xyz - hit.p);
            hit.id = sphereID;
            return hit;
            } // hit found at low root
        
        t = (-b + sqrt(b * b - a * c)) / a;
        if (t > 0.0 && t < 1000.0)
            { // hit found at high root
            hit.t = t;
            hit.p = rayOrigin + (normalize(rayDirection) * t);
            hit.n = -normalize (ubo.spheres[sphereID].xyz - hit.p) ;
            hit.id = sphereID;
            return hit;
            } // hit found at high root
        } // hit found
    hit.t = -1.0f;
    return hit;
    } // sphere intersect

Intersection intersect (vec3 position, vec3 normal, vec3 rayOrigin, vec3 rayDirection)
    {
    Intersection hit;
    float d = dot (normal, rayDirection);
    if (d > 0.0f)
        { // hit found
        hit.t = dot (position - rayOrigin, normal) / d;
        hit.p = rayOrigin + (normalize(rayDirection) * hit.t);
        hit.n = -normal;
        hit.id = N_SPHERES;
        return hit;
        } // hit found
    hit.t = -1;
    return hit;
    }

/* * * * * * * * * * * * * * * * * * * * * * * * * * *
 *  Ray Tracing
 * * * * * * * * * * * * * * * * * * * * * * * * * * */
vec3 computeRayDirection (vec2 uv)
    { // computeRayDirection
    uv = vec2(-1.0, -1.0) + (uv * 2.0);
    return ubo.cameraLook.xyz - vec3 (uv.s, uv.t, 0.0);
    } // computeRayDirection

vec3 fire (vec3 origin, vec3 direction)
    { // fire
    vec3 result = vec3(0.0f, 0.0f, 0.0f);
    for (int n = 0; n < N_BOUNCES; ++n)
        { // for each bounce
        Intersection closest;
        closest.t = 10000.0f;
    
        for (int i = 0; i < N_SPHERES; ++i)
            { // for each sphere
            Intersection hit = intersect(i, origin, direction);
            if (hit.t < closest.t && hit.t >= 0.0f)
                closest = hit;
            } // for each sphere
            
        for (int i = 0; i < N_PLANES; ++i)
            { // for each plane
            Intersection hit = intersect(ubo.positions[i].xyz, ubo.normals[i].xyz, origin, direction);
            if (hit.t < closest.t && hit.t >= 0.0f)
                closest = hit;
            } // for each plane

        if (closest.t < 10000.0f)
            {
            
            closest.n = normalize (closest.n + vec3(
                randomScalar(vec2(closest.n.x)) * ubo.materials[closest.id].z,
                randomScalar(vec2(closest.n.y)) * ubo.materials[closest.id].z,
                randomScalar(vec2(closest.n.z)) * ubo.materials[closest.id].z));
            
            origin = closest.p;
            direction = closest.p + closest.n + randomVector(closest.n);
            result += 0.75 * vec3(ubo.albedos[closest.id]).xyz;
            }
        else
            {
            result += vec3 (0.32, 0.32, 0.32);
            break;
            }
        } // for each bounce
    return result;
    } // fire

void main () 
    { // main
    vec3 average = vec3(0.0, 0.0, 0.0);
    for (int i = 0; i < N_SAMPLES; ++i)
        {
        vec2 offset = vec2 (
            randomScalar(vec2(i, uv.s)) * 0.0025,
            randomScalar(vec2(i, uv.t)) * 0.0025);
        vec3 p = ubo.cameraPosition.xyz;
        vec3 d = computeRayDirection (vec2(uv.s + offset.s, uv.t + offset.t));
        average += fire (p, d);
        }
    color = vec4(average / N_SAMPLES, 1.0);
    } // main
