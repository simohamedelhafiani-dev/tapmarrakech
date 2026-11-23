import { distanceMeters, validCoordinate, validCoordinateInput, normalizeRadius } from './nearby-geo.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
Deno.test('validates coordinate bounds',()=>{assert(validCoordinate(0,0));assert(validCoordinate(31.63,-8.0));assert(!validCoordinate(91,0));assert(!validCoordinate(0,181));assert(!validCoordinate(NaN,0));});
Deno.test('distance at same point is zero',()=>assertEquals(distanceMeters(31.63,-8,31.63,-8),0));
Deno.test('distance uses meters and respects approximate 250m range',()=>{const d=distanceMeters(31.63,-8,31.63225,-8);assert(d>200&&d<300);});
Deno.test('rejects invalid coordinates before geofence',()=>assert(!validCoordinate(999,-999)));

Deno.test('normalizes radius to configured bounds and falls back on malformed input',()=>{assertEquals(normalizeRadius('250'),250);assertEquals(normalizeRadius('NaN'),250);assertEquals(normalizeRadius(-5),50);assertEquals(normalizeRadius(99999),2000);});

Deno.test('rejects missing, null and stringified GPS values',()=>{assert(!validCoordinateInput(null,0));assert(!validCoordinateInput(undefined,0));assert(!validCoordinateInput('31.63',-8));assert(!validCoordinateInput(31.63,'-8'));assert(validCoordinateInput(31.63,-8));});

Deno.test('distance remains finite for antipodal coordinates',()=>{const d=distanceMeters(90,0,-90,180);assert(Number.isFinite(d));assert(d>20000000&&d<20020000);});

Deno.test('rejects null and blank establishment GPS config while accepting valid numeric strings',()=>{assert(!validConfiguredCoordinates(null,0));assert(!validConfiguredCoordinates('', '-8'));assert(!validConfiguredCoordinates('  ','-8'));assert(validConfiguredCoordinates('31.63','-8.0'));assert(!validConfiguredCoordinates('91','-8'));});
