import { distanceMeters, validCoordinate } from './nearby-geo.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
Deno.test('validates coordinate bounds',()=>{assert(validCoordinate(0,0));assert(validCoordinate(31.63,-8.0));assert(!validCoordinate(91,0));assert(!validCoordinate(0,181));assert(!validCoordinate(NaN,0));});
Deno.test('distance at same point is zero',()=>assertEquals(distanceMeters(31.63,-8,31.63,-8),0));
Deno.test('distance uses meters and respects approximate 250m range',()=>{const d=distanceMeters(31.63,-8,31.63225,-8);assert(d>200&&d<300);});
Deno.test('rejects invalid coordinates before geofence',()=>assert(!validCoordinate(999,-999)));
